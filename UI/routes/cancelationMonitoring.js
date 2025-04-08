const {CancelationMonitoring,cancelationMonitoringValidate} = require('../../models/cancelationMonitoring');
const Joi = require('joi');
const mongoose = require('mongoose');
const { getFacilityList } = require('../../models/reservationFacility');
const paginationPageSize = 30;


const joiBookingListQuery = Joi.object({
     date: Joi.date().required(),
     dateOprator: Joi.string().valid('eq', 'lt', 'lte', 'gt', 'gte', 'ne').required()
 });

module.exports = function (router, uiCore) { 
     router.get('/list/:status', async function(req, res) {          
          let rows = CancelationMonitoring.find();
          if (req.params.status && req.params.status != 'all')
          rows = rows.and([{ status : { $in: req.params.status.split(',') } }]);
                         
          if (req.query.date){
               req.query.date = new Date(req.query.date);
               const { error } = joiBookingListQuery.validate(req.query);
               if (!error) 
               {
                    const dateOprator = {};
                    dateOprator["$" + req.query.dateOprator] = req.query.date;
                    
                    rows = rows.and([{"date":dateOprator}]);
               }
          }

          const startRow = ((req.query.page || 1)-1) * paginationPageSize;          
          res.send({
               data: await rows.sort({ _id: -1 })
                    .skip(startRow)
                    // .limit(paginationPageSize)
                    .populate('account')
               , 
               pagination: {
                    more: rows.count()> (startRow + paginationPageSize)
               }
          });
     });
 
     router.get('/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid monitoring id!");

          const monitoring = await CancelationMonitoring.findById(req.params.id);
          if (!monitoring) return res.status(404).send("Cancelation monitoring not found!");
          res.send(monitoring);
     });

     router.post('/', async function(req, res) {
          const { error } = cancelationMonitoringValidate(req.body);
          if (error) return res.status(400).send(error.details[0].message);
                    

          try {
               var facilities = await getFacilityList(req.body.facilities);
          } catch (e){
               return res.status(400).send(e);
          }
          
          const monitoring = new CancelationMonitoring({
               account: req.body.accountId,
               fromDate: req.body.fromDate,
               toDate: req.body.toDate,
               timeFrom: req.body.timeFrom,
               timeTo: req.body.timeTo,
               facilities
          });

          try {
               monitoring.validate()
                    .then(() => monitoring.save())
                    .then((result) => {
                         res.send(result);
                         uiCore.emit('cancelationmonitoring:insert',result);
                    })
                    .catch(err => res.status(400).send(err.message));
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });
     
     router.delete('/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid monitoring id!");
         
          try {
               const monitoring = await CancelationMonitoring.findByIdAndRemove(req.params.id);
               if (!monitoring) return res.status(404).send("Cancelation monitoring not found!");
               uiCore.emit('cancelationmonitoring:delete',monitoring);
               return res.send(monitoring);
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });

     router.put('/refresh/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid monitoring id!");
         
          try {
               const monitoring = await CancelationMonitoring.findById(req.params.id);
               if (!monitoring) return res.status(404).send("Cancelation monitoring not found!");

               monitoring.status = 'active';
               await monitoring.save();
               uiCore.emit('cancelationmonitoring:update',monitoring);
               return res.send(monitoring);
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });     

     return router;
 };