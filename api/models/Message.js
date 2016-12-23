/**
 * Friend.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {

  tableName: 'messages',

  attributes: {
    id: { type: 'integer', primaryKey: true },
    from: { type: 'integer' },
    to: { type: 'integer' },
    message: { type: 'string' },
    date: { type: 'datetime' },
    deleted: { type: 'boolean' }
  }
};
