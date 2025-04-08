const events = require('events');
const EventEmitter = events.EventEmitter;

module.exports = class extends EventEmitter{
    start() { 
        
        return new Promise(async (resolve, reject) => {
            try {
                const debug = new (require('debug')) ('GolfBot:WebUI');
                const path = require('path');
                const express = require('express');
                const logger = require('morgan');
                const Router = express.Router;
                const app = express();
                app.use(express.json());
                app.engine('ejs', require('ejs-locals'));
                app.set('views', path.join(__dirname, '/templates'));
                app.set('view engine', 'ejs');

                app.use('/statics', express.static(path.join(__dirname, '/public')));
                app.use('views', express.static(path.join(__dirname, '/templates')));
                
                /*if (app.get('env') == 'development') {
                    app.use(logger('dev'));
                } else {
                    app.use(logger('default'));
                }*/
                
                app.use('/',require('./routes/root')(Router(),this));                
                app.use('/api/accounts/',require('./routes/accounts')(Router(),this));                
                app.use('/api/bookingShedules/',require('./routes/bookingSchedules')(Router(),this));                
                app.use('/api/cancelationMonitoring/',require('./routes/cancelationMonitoring')(Router(),this));                
                app.use('/api/statistics/',require('./routes/statistics')(Router(),this));                
                app.use('/api/settings/',require('./routes/settings')(Router(),this));                

                const config = require('config');
                const port = parseInt(config.get('port')) || 8080;
                app.listen(port, ()=>{
                    resolve(port);
                });        
            } catch (e) {
                return reject(e);
            }   
        });
    }
};