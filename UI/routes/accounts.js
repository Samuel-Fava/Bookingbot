const { Account, accountValidate } = require('../../models/accounts');
const { BookingSchedule } = require('../../models/bookingSchedules');
const { CancelationMonitoring } = require('../../models/cancelationMonitoring');

const mongoose = require('mongoose');
const paginationPageSize = 30;

module.exports = function (router, uiCore) { 
     router.get('/', async function(req, res) {          
          let rows = Account.find();
          if (req.query.q)
          {
               const regex = new RegExp(".*"+ req.query.q +".*","i" );
               rows = rows.or([{ username: regex }, { label: regex }]);
          }
          
          const startRow = ((req.query.page || 1)-1) * paginationPageSize;
          res.send({
               results: await rows.sort({ label: 1, username: 1 })
                    .skip(startRow)
                    .limit(paginationPageSize)
               , 
               pagination: {
                    more: rows.count()> (startRow + paginationPageSize)
               }
          });
     });
 
     router.get('/list/', async function(req, res) {          
          let rows = Account.find();
                        
          //const startRow = ((req.query.page || 1)-1) * paginationPageSize;          
          res.send({
               data: await rows.sort({ label: 1, username: 1 })
                    //.skip(startRow)
                    //.limit(paginationPageSize)
                    //.populate('account')
               , 
               pagination: {
                    more: false // rows.count() > (startRow + paginationPageSize)
               }
          });          
     });

     router.get('/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid account id!");

          const account = await Account.findById(req.params.id);
          if (!account) return res.status(404).send("Account not found!");          
          account.password = null;
          res.send(account);
     });

     router.post('/', async function(req, res) {
          const { error } = accountValidate(req.body);
          if (error) return res.status(400).send(error.details[0].message);
                    
          const account = new Account({
               label: req.body.label,
               username: req.body.username,
               password: req.body.password
          });

          try {
               account.validate()
                    .then(() => account.save())
                    .then((result) => {
                         res.send(result);
                         uiCore.emit('account:insert',result);
                    })
                    .catch(err => res.status(400).send(err.message));
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });

     router.put('/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid account id!");

          const account = await Account.findById(req.params.id);
          if (!account) return res.status(404).send("Account not found!");
          
          if (!req.body.password) req.body.password = account.password;

          const { error } = accountValidate(req.body);
          if (error) return res.status(400).send(error.details[0].message);
                    
          
          account.label = req.body.label;
          account.username = req.body.username;
          account.password = req.body.password;

          try {
               account.validate()
                    .then(() => account.save())
                    .then((result) => { 
                         result.password = null; 
                         res.send(result); 
                         uiCore.emit('account:update',result);
                    })
                    .catch(err => res.status(400).send(err.message));
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });

     router.delete('/:id', async function(req, res) {
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid account id!");
         
          try {
               const account = await Account.findByIdAndRemove(req.params.id);
               
               if (!account) return res.status(404).send("Account not found!");
               uiCore.emit('account:delete',account);

               const listBooking = await BookingSchedule.find({account: req.params.id});
               for ( let item of listBooking )
               {
                    uiCore.emit('bookingschedule:delete',item);
                    item.remove();
               }

               const listCancelation = await CancelationMonitoring.find({account: req.params.id});
               for ( let item of listBooking )
               {
                    uiCore.emit('cancelationmonitoring:delete',item);
                    item.remove();
               }

               return res.send(account);
          } catch(e){
               res.status(500).send('Oops! Something Went Wrong, Please try again later!');
          }
     });

     return router;
 };