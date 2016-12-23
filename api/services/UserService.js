var crypto = require('crypto');

module.exports = {
  getUserProfileURL: function(user) {
    return '/user/profile/' + user.username;
  },
  getPasswordHash: function(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  },
  checkPassword: function (user, password) {
    return typeof password == 'undefined' || typeof user == 'undefined' ? false : user.password == UserService.getPasswordHash(password);
  },
  sendActivationCode: function(user, callback) {
    var mailOptions = {
      from: 'test@cloudmaps.ru',
      to: user.email,
      subject: 'User Activation Email',
      text: 'http://localhost:1337/user/activate?id=' + user.id + '&t=' + user.password
    };

    EmailService.sendMail(mailOptions, callback);
  },
  updateActivity: function(user, logout) {
    User.update(user.id, { last_activity: logout ? null : new Date().toISOString() }).exec(function(error, rows){
      if(!error) {
        var user = rows[0];
        sails.sockets.blast('online', { id: user.id, last_activity: user.last_activity, last_coordinates: user.last_coordinates });
      }
    });
  },
  getExpirationMilliseconds: function() {
    // После 30 секундного простоя, пользователь считается оффлайн
    return 0.5 * 60 * 1000;
  },
  getExpirationDate: function() {
    var expirationDate = new Date();

    expirationDate.setTime(expirationDate.getTime() - UserService.getExpirationMilliseconds());

    return expirationDate;
  },
  isOnline: function(user) {
    if(!user.last_activity) {
      return false;
    }

    var userLastActivityDate = new Date(user.last_activity);

    return userLastActivityDate.getTime() > UserService.getExpirationDate().getTime();
  },
  updateCoordinates: function(user, coordinates) {
    User.update(user.id, { last_coordinates: coordinates }).exec(function(error, rows){

    });
  },
  dateToStr: function(date) {
    return new Date(date).toISOString().replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(.*)/, '$3.$2.$1 в $4:$5')
  }
};
