const {BookingSchedule,bookingScheduleValidate} = require('../../models/bookingSchedules');
const Joi = require('joi');
const mongoose = require('mongoose');
const { getFacilityList } = require('../../models/reservationFacility');
const paginationPageSize = 30;


const joiBookingListQuery = Joi.object({
     date: Joi.date().required(),
     dateOprator: Joi.string().valid('eq', 'lt', 'lte', 'gt', 'gte', 'ne').required(),
     dateField: Joi.string().valid('targetDate', 'launchDate')
 });

module.exports = function (router, uiCore) { 
     router.get('/list/:status', async function(req, res) {          
          let rows = BookingSchedule.find();
          if (req.params.status && req.params.status != 'all')
               rows = rows.and([{ status : { $in: req.params.status.split(',') } }]);
          
               
          if (req.query.date){
               req.query.date = new Date(req.query.date);
               const { error } = joiBookingListQuery.validate(req.query);
               if (!error) 
               {
                    const dateOprator = {};
                    dateOprator["$" + req.query.dateOprator] = req.query.date;
                    
                    const dateField = req.query.dateField || "launchDate";
                    const filterObject = {};
                    filterObject[dateField] = dateOprator;
                    rows = rows.and([ filterObject ]);
               }
          }

          const startRow = ((req.query.page || 1)-1) * paginationPageSize;          
          res.send({
               data: await rows.sort({ launchDate: 1 })
                    .skip(startRow)
                    .limit(paginationPageSize)
                    .populate('account','label username')
                    //.select({ account: 1, targetDate: 1, launchDate: 1, timeFrom: 1, timeTo: 1, status: 1 })
               , 
               pagination: {
                    more: rows.count()> (startRow + paginationPageSize)
               }
          });
     });
 
     router.get('/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid schedule id!");

          const schedule = await BookingSchedule.findById(req.params.id);
          if (!schedule) return res.status(404).send("Booking schedule not found!");
          res.send(schedule);
     });

     router.post('/', async function(req, res) {
          const { error } = bookingScheduleValidate(req.body);
          if (error) return res.status(400).send(error.details[0].message);
          

          try {
               var facilities = await getFacilityList(req.body.facilities);
          } catch (e){
               return res.status(400).send(e);
          }

          const schedule = new BookingSchedule({
               account: req.body.accountId,
               targetDate: req.body.targetDate,
               launchDate: req.body.launchDate,
               timeFrom: req.body.timeFrom,
               timeTo: req.body.timeTo,
               facilities
          });

          try {
               schedule.validate()
                    .then(() => schedule.save())
                    .then((result) => {
                         res.send(result)
                         uiCore.emit('bookingschedule:insert',result);
                    })
                    .catch(err => res.status(400).send(err.message));
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });
     
     router.delete('/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid schedule id!");
         
          try {
               const schedule = await BookingSchedule.findByIdAndRemove(req.params.id);
               if (!schedule) return res.status(404).send("Booking schedule not found!");
               uiCore.emit('bookingschedule:delete',schedule);

               return res.send(schedule);
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });


     return router;
 };