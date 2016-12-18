var crypto = require('crypto');

module.exports = {
  getUserProfileURL: function(user) {
    return '/user/profile/' + user.id;
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
  }
};
