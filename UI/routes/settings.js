const {Settings,settingsValidate, currentSettings} = require('../../models/settings');
const mongoose = require('mongoose');


module.exports = function (router, uiCore) { 
     router.get('/', async function(req, res) { 
          res.send(await currentSettings(true));
     }); 
 

     router.put('/', async function(req, res) {
          const { error } = settingsValidate(req.body);
          if (error) return res.status(400).send(error.details[0].message);
          
          const settings = await currentSettings();          
          settings.userTimezone = req.body.userTimezone;
          settings.userTimezoneOffset = req.body.userTimezoneOffset;
          settings.bookingTargetTime = req.body.bookingTargetTime;
          settings.startBefore = req.body.startBefore;
          settings.openTeeTimes = req.body.openTeeTimes;
          settings.monitoringInterval = req.body.monitoringInterval;
          
          try {
               settings.validate()
                    .then(() => settings.save())
                    .then((result) => 
                    {
                         uiCore.emit('settings:update',result);
                         return res.send(result);
                    })
                    .catch(err => res.status(400).send(err.message));
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });

     return router;
 };