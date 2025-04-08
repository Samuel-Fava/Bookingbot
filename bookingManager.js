const Browser = require('./Browser');
const BookingBot = require('./BookingBot');
const { BookingSchedule } = require('./models/bookingSchedules');
const { CancelationMonitoring } = require('./models/cancelationMonitoring');
const { Settings, currentSettings, DateMethods } = require('./models/settings');
const moment = require('moment-timezone');

const refreshList = 300;

module.exports.create = () => new Promise(async (resolve, reject) => {
    const bots = [];
    let settings = null;
    const controller = {
        reloadSettings: async function(){
            settings = await currentSettings(true);
            bots.forEach(bot => bot.settings = settings);
        },
        deleteBot: function(botId){
            let bot = bots.find(item => item.id === botId);
            if (bot) {
                const index = bots.indexOf(bot);
                if (index >= 0) bots.splice(index,1);
                bot.destroy().then(()=>{
                    delete bot;
                });
            }
        },
    };
    await controller.reloadSettings();

    const processQuery = function(records){
        records.forEach(record => {
            if (!bots.find((item)=> item.id === record._id.toString()))
            {
                
                const bot = new BookingBot(record);
                bots.push(bot);
                bot.on('changeStatus', (newStatus, statusMessage) => {                    
                    if (bot.dataSource instanceof BookingSchedule)
                        var dataSourceQuery = BookingSchedule.findById(bot.id);
                    else 
                        var dataSourceQuery = CancelationMonitoring.findById(bot.id);
                    dataSourceQuery.then( dataSource => {
                        switch (newStatus){
                            case "new": break;
                            case "captcha": 
                                dataSource.status = newStatus;
                                dataSource.statusMessage = "";
                                dataSource.statusTime = new Date();
                                dataSource.save();
                                break;                                                  
                            case "initialized":
                            case "inprogress": 
                                dataSource.status = "inprogress";
                                dataSource.statusMessage = "";
                                dataSource.statusTime = new Date();
                                dataSource.save();
                                break;                                                  
                            case "successful":
                            case "outofdate": 
                            case "failed": 
                                dataSource.status = newStatus;
                                dataSource.statusMessage = statusMessage;
                                dataSource.statusTime = new Date();
                                dataSource.save()
                                    .then( async (result) => { 
                                        const index = bots.indexOf(bot);
                                        if (index >= 0) bots.splice(index,1);
                                        return bot.destroy();
                                    })
                                    .then(()=>{
                                        
                                    })
                                    .catch(err => console.error(err.message));
                                break;
                        }
                    });

                }); 
            }
        });
    };

    Browser.initialize().then(()=>{        
        const checkingBotsList = function(){
            const timeoutTask = new Date();
            timeoutTask.setMinutes( timeoutTask.getMinutes() - (settings.bookingInterval || 1) );

            const userToday = DateMethods.userToday();
            const bookingTargetDateTime = settings.bookingTargetDateTime;
            const startBeforeNow = moment(bookingTargetDateTime).add(settings.startBefore * -1, 'm' ).toDate();

            const highLimitedHour = moment(bookingTargetDateTime).add(10, 'm' ).toDate();
            
            if (startBeforeNow <= new Date() && highLimitedHour >= new Date())
            {
                BookingSchedule.find(
                    { $or : [
                        {
                            $and : [ 
                                { status: 'pending' },
                                { launchDate : userToday }
                            ]
                        },
                        {   
                            $and : [
                                { status: 'inprogress' },
                                { statusTime : timeoutTask }
                            ]
                        }
                    ] } 
                )
                .populate('account')
                .then(processQuery)
                .catch((error)=>{
                    console.error(error);
                });
            }

            const today = DateMethods.today();
            const bookingLastOpenDate = DateMethods.today();
            bookingLastOpenDate.setUTCDate(bookingLastOpenDate.getUTCDate() + settings.openTeeTimes);
            
            CancelationMonitoring.find(
                { $or : [
                    {
                        $and : [ 
                            { status: 'active' },
                            { fromDate : { $lte: bookingLastOpenDate } },
                            { toDate : { $gte: today } }
                        ]
                    },
                    {
                        $and : [ 
                            { status: 'inprogress' },
                            { statusTime : { $lt: timeoutTask } }
                        ]
                    }
                ] }
            )
            .populate('account')
            .then( records => {
                processQuery(records);
                setTimeout(checkingBotsList, refreshList);
            })
            .catch( error => {
                setTimeout(checkingBotsList, refreshList);
            });      
               
        };
        setTimeout(checkingBotsList, refreshList);

        return resolve(controller);
    }).catch((error)=>{
        // error
        return reject(error);
    });
});

/*module.exports.start = () => new Promise(async (resolve, reject) => {
    

});
*/
