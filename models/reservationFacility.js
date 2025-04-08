const mongoose = require('mongoose');

const reservationFacilitySchema = new mongoose.Schema({
    key:{
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true
    }
});

const ReservationFacility = mongoose.model('reservationFacility', reservationFacilitySchema);

exports.reservationFacilitySchema = reservationFacilitySchema;
exports.ReservationFacility = ReservationFacility;

exports.getFacilityList = (keysArray) => new Promise(async (resolve, reject) => {
    if (!(keysArray && keysArray.length > 0))
        return reject('Facility is required, Please select at least one facility.');
    
    return resolve(ReservationFacility.find({ key : { $in: keysArray } }));
});