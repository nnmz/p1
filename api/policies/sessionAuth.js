/**
 * sessionAuth
 *
 * @module      :: Policy
 * @description :: Simple policy to allow any authenticated user
 *                 Assumes that your login action in one of your controllers sets `req.session.authenticated = true;`
 * @docs        :: http://sailsjs.org/#!/documentation/concepts/Policies
 *
 */
module.exports = function(req, res, next) {

  // Пользован не активирован
  if(req.session.user && !req.session.user.active) {
    return res.view('user/resend_activation_code');
  }
  // Пользователь активирован
  if (req.session.user && req.session.user.active) {
    return next();
  }

  // Пользователь не авторизован
  return res.redirect('/login');
};
