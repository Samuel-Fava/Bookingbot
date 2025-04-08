const { BookingSchedule } = require('../../models/bookingSchedules');
const { CancelationMonitoring } = require('../../models/cancelationMonitoring');
const { DateMethods } = require('../../models/settings');

module.exports = function (router,webUI) { 
    router.get('/', function(req, res) {        
        const today = DateMethods.today();

        BookingSchedule.aggregate([
            { $match: { launchDate: { $eq: today } } },
            { $group : { _id: "$status", count: { $sum: 1 } } }
        ]).then(function (resultToday) {
            BookingSchedule.aggregate([
                { $match: { launchDate: { $ne: today } } },
                { $group : { _id: "$status", count: { $sum: 1 } } }
            ]).then(function (resultTotal) {
                CancelationMonitoring.find( { 
                    status: { $in: ['active', 'inprogress', 'captcha' ] }
                    ,toDate : { $gte: today }
                } ).count().then(function (monitoringActiveResult) {
                    CancelationMonitoring.find().count()
                    .then(function (monitoringTotal) {
                        const result = {};
                        const staticsItem = ['outofdate','pending','inprogress','failed','successful','captcha'];
                        
                        for (let item of staticsItem)
                        {
                            result[item] = {
                                today: resultToday.find(r=>r._id === item),
                                total: resultTotal.find(r=>r._id === item)
                            };
                            if (result[item].today) result[item].today = result[item].today.count; else result[item].today = 0;
                            if (result[item].total) result[item].total = result[item].total.count; else result[item].total = 0;
                            result[item].total += result[item].today;                            
                        }
                        result.cancelationMonitoring = { 
                            active: monitoringActiveResult || 0,
                            total: monitoringTotal || 0
                        };

                        res.send(result);
                    });
                });
            });
        });
    });

    return router;
};
