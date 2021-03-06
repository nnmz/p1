/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

  register: function(req, res){
    if(req.method == 'POST'){
      var model = req.allParams();
      model.password = UserService.getPasswordHash(model.password);

      delete model.id;
      User.create(model, function(error, data){
        if(error){
          res.view('user/error', {message: 'При регистрации пользователя произошла ошибка: ' + error.message});
        }
        else{
          UserService.sendActivationCode(data, function(error, info){
            if(error){
              res.view('user/error', {message: 'При регистрации пользователя произошла ошибка: ' + error.message});
            }
            else res.view('user/after_register');
          });
        }
      });
    }
    else if(req.method == 'GET'){
      res.view();
    }
  },

  login: function(req, res){
    if(req.method == 'POST'){
      User.findOne({username: req.param('username')}).exec(function(error, user){
        if(error){
          res.view('user/error',{message: 'При проверке логина и пароля произошла ошибка: ' + error.message});
        }
        else{
          if(UserService.checkPassword(user, req.param('password'))){
            req.session.user = user;

            return res.redirect(UserService.getUserProfileURL(user));
          }
          else{
            res.view('user/error',{message: 'Неверный логин или пароль'});
          }
        }
      });
    }
    else{
      if(typeof req.session.user == 'undefined'){
        return res.view();
      }
      else{
        return res.redirect(UserService.getUserProfileURL(req.session.user));
      }
    }
  },

  profile: function(req, res){
    var current_user = req.session.user;

    if(!current_user) {
      return res.negotiate();
    }

    User.findOne(current_user.id).populate('friends').exec(function(error, user) {
      if(!error){
        current_user = user;

        User.findOne({ username: req.param('id') }).exec(function(error, user){
          if(error){
            res.view('user/error',{message: 'Ошибка: ' + error.message});
          } else if(!user) {
            res.view('user/error',{message: 'Ошибка: Пользователь не найден'});
          } else {
            var isFriend = _.some(current_user.friends, function(friend){return friend.id_friend == user.id;});

            if(current_user.id == user.id || isFriend) {
              res.view({
                user: _.omit(user, 'password'),
                current_user: _.omit(req.session.user, 'password')
              });
            } else {
              res.view('user/error',{message: 'Ошибка: Просмотр профиля недоступен. Пользователь не является Вашим другом'});
            }
          }
        });
      } else {
        res.view('user/error',{message: 'Ошибка: Ваш пользователь удален'});
      }
    });
  },

  friends: function(req, res){
    if(req.xhr){
      switch(req.method){
        case 'GET':
          User.findOne(parseInt(req.param('id', 0))).populate('friends').exec(function(error, user){
            if(error)
              return res.negotiate(error);
            else {
              var friend_ids = _.map(user.friends, function(friend){return friend.id_friend;});
              User.find(friend_ids).exec(function(error, friends){
                if(error)
                  return res.negotiate(error);
                else{
                  switch(req.param('view')) {
                    case 'json':
                      return res.json(_.map(friends, function(friend) { return _.omit(friend, 'password') }));
                      break;

                    case 'as-list-for-messanger':
                      return res.view('user/as_list_for_messanger', { friends: friends });
                      break;

                    default:
                      return res.view({ friends: friends });
                      break;
                  }
                }
              });
            }
          });
          break;
        case 'DELETE':
          var id = parseInt(req.param('id'));
          Friend.destroy({
            id_user: [id, req.session.user.id],
            id_friend: [id, req.session.user.id]
          }).exec(function(error){
            if(error){
              return res.negotiate(error);
            }
            else{
              sails.sockets.blast('delete_friend',{
                id_user: req.session.user.id,
                id_friend: id
              });
              return res.ok();
            }
          });
          break;
        default:
          return res.badRequest();
      }
    }
    else{
      return res.badRequest();
    }
  },

  requests: function(req, res){
    if(req.xhr){
      switch(req.method){
        case 'GET':
          Request.find({
            id_requested: parseInt(req.param('id', 0))
          }).populate('id_requesting').exec(function(error, requests){
            if(error){
              return res.negotiate(error);
            }
            else {
              return res.view({requests: _.map(requests, function(request){return request.id_requesting;})});
            }
          });
          break;
        case 'PUT':
          Friend.create([{
            id_user: req.session.user.id,
            id_friend: parseInt(req.param('id'))
          },{
            id_friend: req.session.user.id,
            id_user: parseInt(req.param('id'))
          }]).exec(function(error, data){
            if(error)
              return res.negotiate(error);
            else{
              Friend.publishCreate(data[0], req);
              Request.destroy({
                id_requesting: parseInt(req.param('id')),
                id_requested: req.session.user.id
              }).exec(function(error){
                if(error)
                  return res.negotiate(error);
                else{
                  return res.ok();
                }
              });
            }
          });
          break;
        case 'DELETE':
          Request.destroy({
            id_requesting: parseInt(req.param('id')),
            id_requested: req.session.user.id
          }).exec(function(error){
            if(error)
              return res.negotiate(error);
            else{
              return res.ok();
            }
          });
          break;
        default:
          return res.badRequest();
      }
    }
    else{
      return res.badRequest();
    }
  },

  avatar: function(req, res){
    var fs = require('fs');
    var isCropped = req.param("cropped");
    var avatar_dir = sails.config.rootPath + '/avatars/';

    if(req.method == 'GET'){
      var fileName = (isCropped ? 'cropped_' : '') + req.param('id') + '.jpg';
      var avatar = avatar_dir + fileName;

      fs.stat(avatar, function(error, stats){
        if(error){
          return res.sendfile(avatar_dir + 'default-avatar.jpg');
        }
        else if(stats.isFile()){
          return res.sendfile(avatar);
        }
        else{
          return res.notFound();
        }
      });
    }
    else if(req.method == 'POST'){
      req.file('file').upload({}, function(error, files){
        if(error)
          return res.negotiate(error);
        else{
          var fileName = (isCropped ? 'cropped_' : '') + req.session.user.id + '.jpg';

          fs.rename(files[0].fd, avatar_dir + fileName, function(error){
            if(error)
              return res.negotiate(error);
            else
              return res.ok();
          });
        }

      });
    }
  },

  logout: function(req, res){
    UserService.updateActivity(req.session.user, true);
    delete req.session.user;
    return res.redirect('/');
  },

  list: function(req, res){
    if(req.xhr){
      Friend.find({id_user: req.session.user.id}).exec(function(error, friends){
        if(error)
          return res.negotiate(error);
        else{
          var exclude = _.map(friends, function(friend){return friend.id_friend;});
          Request.find({id_requesting: req.session.user.id}).exec(function(error, requests){
            if(error)
              return res.negotiate(error);
            else{
              exclude = exclude.concat(_.map(requests, function(request){return request.id_requested;}));
              exclude.push(req.session.user.id);
              User.find({id: {'!': exclude}}).exec(function(error, list){
                if(error)
                  return res.negotiate(error);
                else {
                  return res.view({list: list});
                }
              });
            }
          });
        }
      });
    }
    else{
      return res.badRequest();
    }
  },

  subscribe: function(req, res){
    if(req.isSocket && req.session.user){
      Request.watch(req);
      Friend.watch(req);
      Message.watch(req);
    }
    return res.ok();
  },

  request: function(req, res){
    if(req.xhr){
      var id_requested = req.param('id_requested');
      Request.count({
        id_requesting: req.session.user.id,
        id_requested: id_requested
      }).exec(function(error, count){
        if(error)
          return res.negotiate(error);
        else{
          if(!count){
            Request.create({
              id_requesting: req.session.user.id,
              id_requested: id_requested
            }).exec(function(error, request){
              if(error){
                return res.send({
                  success: false,
                  error: error
                });
              }
              else{
                Request.findOne(request.id).populateAll().exec(function(error, request){
                  request.id_requesting = _.omit(request.id_requesting, 'password');
                  Request.publishCreate(request, req);
                  return res.send({
                    success: true,
                    message: "Заявка успешно отправлена"
                  });
                });
              }
            });
          }
          else{
            return res.send({
              success: true,
              message: "Заявка уже существует"
            });
          }
        }
      });
    }
    else{
      return res.badRequest();
    }
  },

  activate: function(req, res) {
    if(req.param('id') && req.param('t')){
      var id = parseInt(req.param('id')),
          token = req.param('t');

      User.findOne(id).exec(function(error,user){
        if(error){
          res.view('user/error',{message: 'При активации пользователя произошла ошибка: ' + error.message});
        }
        else{
          if(user.password == token){
            User.update(id, {active: true}).exec(function(error, rows){
              if(error) {
                res.view('user/error',{message: 'При активации пользователя произошла ошибка: ' + error.message});
              } else if(req.session.user && rows.length) {
                req.session.user = rows[0];
                res.redirect(UserService.getUserProfileURL(req.session.user));
              } else {
                res.redirect('/login');
              }
            });
          }
          else{
            res.view('user/error',{message: 'При активации пользователя произошла ошибка: неверный ключ активации'});
          }
        }
      });
    } else {
      res.view();
    }
  },

  'update-coordinates': function(req, res) {
    var user = req.session.user,
        coordinates = req.param('coordinates');

    if(req.method == 'POST' && user){
      UserService.updateCoordinates(user, coordinates);
    } else {
      return res.negotiate();
    }

    return res.ok();
  },

  'resend-activation-code':  function(req, res){
    var user = req.session.user;

    if(user && !user.active) {
      UserService.sendActivationCode(user, function(error, info){
        if(error){
          res.view('user/error', {message: 'При регистрации пользователя произошла ошибка: ' + error.message});
        }
        else res.view('user/after_resend_activation_code');
      });
    } else if(user && user.active) {
      res.redirect(UserService.getUserProfileURL(user));
    } else {
      res.redirect('user/register');
    }
  },

  history: function(req, res) {
      User.find({}, function(error, rows) {
        if(error)
          return res.negotiate(error);
        else {
          res.json(rows.map(function(user) { return { id: user.id, last_activity: user.last_activity, last_coordinates: user.last_coordinates }}));
        }
      });
  },

  messages: function(req, res) {
    var user = req.session.user,
        from = parseInt(req.param('id', 0));

    if(!from) {
      return { messages: [] };
    }

    Message.find({
      to: [user.id, from],
      from: [user.id, from]
    }).exec(function(error, messages) {
      return res.view({
        messages: error ? [] : messages,
        to: user.id,
        from: from
      });
    });
  },

  message: function(req, res) {
    if(req.xhr) {
      if (req.method == 'POST') {
        var user = req.session.user,
          to = req.param('id', 0),
          message = req.param('message');

        if (!to) {
          return res.negotiate('Не указан адресат сообщения');
        }

        User.findOne(to).exec(function (error, userTo) {
          if (error) {
            return res.negotiate(error);
          }

          Message.create({
            from: user.id,
            to: userTo.id,
            message: message,
            date: new Date().toISOString(),
            deleted: false
          }).exec(function (error, row) {
            if (error) {
              return res.negotiate(error);
            }
            Message.publishCreate(row, req);
            res.ok();
          });
        });
      }
    }
  }
};
