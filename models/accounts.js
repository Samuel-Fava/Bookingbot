const Joi = require('joi');
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    label: String,
    username: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 255,
        validate:{
            validator: async function(v) {   
                const result = await Account.find({username: new RegExp(v,"i"), _id: {$ne: this._id}});
                return !(result && result.length);               
            },
            message: 'This username already exists in database.'
        }
    },
    password: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 100
    },
    passwordStatus: {
        type: String,
        default: 'pending',
        enum:['verified','pending','Invalid','Inactive']
    }
});

const joiSchema = Joi.object({
    label: Joi.string().max(100),
    username: Joi.string().min(3).max(255).required(),
    password: Joi.string().min(1).max(100).required(),
    passwordStatus: Joi.string()
});

const Account = mongoose.model('Accounts', accountSchema);

exports.accountSchema = accountSchema;
exports.Account = Account;
exports.accountValidate = (account) => joiSchema.validate(account);


