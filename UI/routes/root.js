module.exports = function (router,webUI) { 
     let facilityList = [];
     const { ReservationFacility } = require('../../models/reservationFacility');
     ReservationFacility.find().then( result => {
          facilityList = result;
     });

     router.get('/', function(req, res) {
          res.render('index');
     });
 
     router.get('/bookinglist', function(req, res) {
          res.render('bookingList');
     });
     
     router.get('/booking', function(req, res) {
          res.render('booking' , { facilityList });
     });
 
     router.get('/settings', function(req, res) {
          res.render('settings');
     });

     router.get('/accountlist', function(req, res) {
          res.render('accountList');
     });

     router.get('/editaccount', function(req, res) {
          res.render('editaccount');
     });

     router.get('/monitoring', function(req, res) {
          res.render('monitoring', { facilityList });
     });

     router.get('/monitoringlist', function(req, res) {
          res.render('monitoringList');
     });

     return router;
 };
 