const Joi = require('joi');
const mongoose = require('mongoose');
const moment = require('moment-timezone');

const settingsSchema = new mongoose.Schema({
    userTimezone: {
        type: String,
        required: true
    },
    userTimezoneOffset: {
        type: String,
        required: true
    },
    bookingTargetTime: {
        type: String,
        required: true,
        match: /^([0-9]{2})\:([0-9]{2})$/
    },
    startBefore:{
        type: Number,
        required: true
    },
    openTeeTimes:{
        type: Number,
        default: 7, 
        required: true
    },
    monitoringInterval:{
        type: Number,
        default: 10, 
        required: true
    }
});

settingsSchema.virtual('bookingTargetDateTime')
    .get(function(){
        const today = DateMethods.today();
        var offset = moment.tz.zone(this.userTimezone).parse(new Date());

        const parts = this.bookingTargetTime.split(':').map(item=>parseInt(item));
        let Minutes = (parts[0] * 60) + parts[1] + offset;
        if (Minutes > 60 * 24)
            Minutes-= 60 * 24;
        
        return moment(today).add(Minutes,'m').toDate();
    });


settingsSchema.virtual('monitoringExpireDate')
    .get(function(){
        const today = DateMethods.today();
        var offset = moment.tz.zone(this.userTimezone).parse(new Date());

        const parts = "20:30".split(':').map(item=>parseInt(item));
        let Minutes = (parts[0] * 60) + parts[1] + offset;
        if (Minutes > 60 * 24)
            Minutes-= 60 * 24;
        
        return moment(today).add(Minutes,'m').toDate();
    });    

const joiSchema = Joi.object({
    userTimezone: Joi.string().required(),
    userTimezoneOffset: Joi.string().required(),
    bookingTargetTime: Joi.string().regex(/^([0-9]{2})\:([0-9]{2})$/).required(),
    startBefore: Joi.number().min(1).max(70).required(),
    openTeeTimes: Joi.number().min(1).max(40).required(),
    monitoringInterval: Joi.number().min(10).max(60 * 10).required(),
});

const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
const DateMethods = {
    toUTCDateTime: (date) => moment.tz(date, global.currentSettings.userTimezone).utc().format(),
    toUTCDate: (date) => new Date(Date.UTC(new Date(date).getFullYear(),new Date(date).getMonth(),new Date(date).getDate(),0,0,0,0)) ,
    toUserDate: (dateUTC) => new Date(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate(),0,0,0,0 ).toLocaleDateString(),    
    toUserDateTime: (dateUTC) => moment(dateUTC).tz(global.currentSettings.userTimezone).format(),
    today: () => new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0)),
    userToday: () => {
        const today = new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate(),0,0,0,0));
        var offset = moment.tz.zone(global.currentSettings.userTimezone).parse(new Date());
        today.setMinutes(offset);
        return today;
    }
};

exports.settingsSchema = settingsSchema;
exports.Settings = Settings;
exports.settingsValidate = (settings) => joiSchema.validate(settings);
exports.DateMethods = DateMethods;
exports.currentSettings = (reload) => new Promise(async (resolve, reject) => {
    try{

        if (reload || !global.currentSettings)
            {
                global.currentSettings = await Settings.findOne();
                if (!global.currentSettings) {
                    global.currentSettings = new Settings({
                        userTimezone: "US/Eastern",
                        userTimezoneOffset: "-05:00",
                        bookingTargetTime: "19:00",
                        startBefore: 5,
                        openTeeTimes: 7,
                        monitoringInterval: 10
                    });
                    global.currentSettings.save();
                }
            }
    } catch(e){
        return reject(e);
    }
    
    return resolve(global.currentSettings);
});



