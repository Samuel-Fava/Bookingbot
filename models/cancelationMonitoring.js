const Joi = require('joi');
const mongoose = require('mongoose');
const {Account} = require('./accounts');
const {DateMethods} = require('./settings');
const { reservationFacilitySchema } = require('./reservationFacility');

const cancelationMonitoringSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Accounts',
        required: true,
        validate: {
            validator: async function(v) {   
                const result = await Account.findById(v);
                return (result && result.length);               
            },
            message: 'Account not found.'
        }
    },
    fromDate: {
        type: Date,
        get: DateMethods.toUserDate,
        set: DateMethods.toUTCDate,
        required: true,
    },
    toDate: {
        type: Date,
        get: DateMethods.toUserDate,
        set: DateMethods.toUTCDate,
        required: true
    },
    timeFrom: {
        type: String,
        required: true,
        match: /^([0-9]{2})\:([0-9]{2})$/
    },
    timeTo: {
        type: String,
        required: true,
        match: /^([0-9]{2})\:([0-9]{2})$/
    },
    facilities:{
        type: [ reservationFacilitySchema ],
        required: true,
        default: [],
        validate: {
            validator: async function(v) {                   
                return (v && v.length > 0);               
            },
            message: 'Facility is required, Please select one facility at least.'
        }
    }, 
    status: {
        type: String,
        default: 'active',
        enum:['outofdate','active','inprogress','failed','successful','captcha']
    },
    statusMessage: {
        type: String
    },
    statusTime: {
        type: Date
    }
}, {toJSON: {getters: true}} );

const joiSchema = Joi.object({
    accountId: Joi.objectId().required(),
    fromDate: Joi.date().required(),
    toDate: Joi.date().required(),
    timeFrom: Joi.string().regex(/^([0-9]{2})\:([0-9]{2})$/).required(),
    timeTo: Joi.string().regex(/^([0-9]{2})\:([0-9]{2})$/).required(),
    facilities: Joi.array().min(1).required()
});

const CancelationMonitoring = mongoose.model('CancelationMonitoring', cancelationMonitoringSchema);

exports.cancelationMonitoringSchema = cancelationMonitoringSchema;
exports.CancelationMonitoring = CancelationMonitoring;
exports.cancelationMonitoringValidate = (monitoring) => joiSchema.validate(monitoring);

