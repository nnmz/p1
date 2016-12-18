var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var transporter = nodemailer.createTransport(smtpTransport({
    host: 'localhost',
    port: 25,
    ignoreTLS: true
  })
);

module.exports = {
  sendMail: function(options, callback) {
    return transporter.sendMail(options, callback);
  }
};
