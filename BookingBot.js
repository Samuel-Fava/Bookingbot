const events = require('events');
const EventEmitter = events.EventEmitter;
const Browser = require('./Browser');
const { BookingSchedule } = require('./models/bookingSchedules');
const { Settings, currentSettings, DateMethods } = require('./models/settings');
const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');

var rmdir = function (dir) {
    var list = fs.readdirSync(dir);
    for (var i = 0; i < list.length; i++) {
        var filename = path.join(dir, list[i]);
        var stat = fs.statSync(filename);

        if (filename == "." || filename == "..") {
            // pass these files
        } else if (stat.isDirectory()) {
            // rmdir recursively
            try {
                rmdir(filename);
            } catch (e) { }
        } else {
            // rm fiilename
            try {
                fs.unlinkSync(filename);
            } catch (e) { }
        }
    }
    fs.rmdirSync(dir);
};

async function isVisible(page, xPathSelector) {
    try {
        await page.waitForXPath(xPathSelector, { visible: true, timeout: 1000 });
        return true;
    } catch {
        return false;
    }
}

//const { settings } = require('cluster');

async function sleep(millis) {
    if (millis > 0)
        return new Promise(resolve => setTimeout(resolve, millis));
    else
        return true;
}

class BookingBot extends EventEmitter {
    get facilityArray() {
        const tmpFaci = this.dataSource.facilities || [];
        if (tmpFaci.length === 0)
            tmpFaci.push({ key: '' });
        return tmpFaci;
    }
    constructor(dataSource) {
        super();
        super.dataSource = dataSource;
        super.status = 'new'; /* new, initialized, inprogress, successful, failed, outofdate, captcha */
        super.failedMessage = '';
        super.lastStatusTime = new Date();
        super.isCancelMornitoring = false;
        currentSettings(true).then((settings) => {
            super.settings = settings;

            if (dataSource instanceof BookingSchedule)
            {
                super.bookingIntervalMillisecond = 2 * 1000;
                super.isCancelMornitoring = false;
            }
            else {
                super.bookingIntervalMillisecond = (self.settings.monitoringInterval || 10) * 1000;
                super.isCancelMornitoring = true;
            }
        });

        const self = this;
        setTimeout(function () {
            self.initialize();
        }, 1000);
    }

    get id() {
        if (this.dataSource)
            return this.dataSource._id.toString();
        return "";
    }

    destroy() {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.page)
                    return resolve(this.page.browser().close());
                else
                    return resolve(true);
            } catch (e) {
                return reject(e);
            }
        });
    }

    initialize(reset) {
        if (this.checkOutofDate())
            return;

        try {
            const userDataDir = './data/' + this.dataSource.account._id.toString() + ((this.dataSource instanceof BookingSchedule) ? "-booking" : "monitoring") + '/';
            if (reset)
                try {
                    rmdir(userDataDir);
                } catch (e) { }

            Browser.newBrowser('https://foreupsoftware.com/index.php/booking/19765#/account', userDataDir, ".navbar-brand")
                .then(page => {
                    this.page = page;

                    this.startProcess(100 * 1);

                    this.status = 'initialized';
                    this.emit('changeStatus', this.status, '');

                }).catch(err => {
                    console.error(err);
                    this.status = 'failed';
                    this.emit('changeStatus', this.status, err.message);
                    this.destroy();
                });

        } catch (e) {
            console.log('Error on bot initializing', e);
        }
    }

    startProcess(timer) {
        const self = this;
        if(this.isCancelMornitoring)
        {
            const now = new Date();
            let toDate = new Date(this.dataSource.toDate);
            if(now.getDate() < toDate.getDate())
            {
                setTimeout(function () {
                    self.process()
                }, timer || 1000 * 60);
            }
            else{
                this.status = 'failed';
                this.emit('changeStatus', this.status, this.failedMessage || 'Out of Date.');
                return;
            }
        }
        else 
        {
            this.attempt = (this.attempt || 0) + 1;
            if (this.attempt > 5) {
                this.status = 'failed';
                this.emit('changeStatus', this.status, this.failedMessage || 'Stopped after 5 times failure.');
                return;
            }
            setTimeout(function () {
                self.process()
            }, timer || 1000 * 60);
        }
    }

    process() {
        this.checkLogin()
            .then(logged_in => {
                if (logged_in)
                    return this.checkHasReservation();
                return null;
            })
            .then(hasReservation => {
                try {

                    if (hasReservation === true) {
                        this.status = 'failed';
                        this.failedMessage = 'This account currently has a reserved tee time.';
                        this.emit('changeStatus', this.status, this.failedMessage);
                    } else if (hasReservation === false) {
                        this.status = 'inprogress';
                        this.failedMessage = '';
                        this.emit('changeStatus', this.status, this.failedMessage);

                        this.continuousStart();
                    }
                } catch (err) {
                    console.error(err);
                    this.startProcess();
                }
            })
            .catch(err => {
                console.error(err);
                this.startProcess();
            });
    }

    fullReset() {
        return new Promise(async (resolve, reject) => {
            this.destroy().then().catch(error => {

            }).finally(() => {
                return resolve(this.initialize(true));
            });
        });
    }
    checkLogin(isRetryMode) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!await this.page.evaluate(() => USER && USER.logged_in)) {
                    if (!isRetryMode)
                        return resolve(this.Login());
                    else
                        return resolve(false);
                }

                await this.updateAccount("verified");
                return resolve(true);
            } catch (e) {
                return reject(e);
            }
        });
    }

    detectLoginResult() {
        return new Promise(async (resolve, reject) => {
            for (let i = 1; i <= 6; i++) {
                try {
                    await this.page.waitForSelector("#login-error", { visible: true, timeout: 1000 * 5 });
                    return resolve();
                } catch (e) { }

                try {
                    await this.page.waitForSelector(".logout", { timeout: 1000 * 5 });
                    return resolve();
                } catch (e) { }
            }
            reject(new Error("Detect login result failed"));
        });
    }

    Login() {
        return new Promise(async (resolve, reject) => {
            try {
                await this.page.evaluate(() => {
                    if ($('#login_email:visible').length === 0)
                        $('#navigation .login').click();
                });

                //await this.page.waitFor(500);
                await this.page.waitForSelector("#login_form");
                await this.page.click("#login_email");
                await this.page.type("#login_email", this.dataSource.account.username);
                await this.page.click("#login_password");
                await this.page.type("#login_password", this.dataSource.account.password);
                await this.page.evaluate(() => $("button.btn:contains('Log In')").click());
                await this.detectLoginResult();
                const error = await this.page.evaluate(() => $('#login-error').text());

                if (error) {
                    await this.updateAccount("Invalid");

                    this.status = 'failed';
                    this.failedMessage = 'Login failed.' + error;
                    this.emit('changeStatus', this.status, error);

                    return resolve(false);
                } else {
                    await this.page.reload();
                    return resolve(this.checkLogin(true));
                }
            } catch (e) {
                reject(e);
            }
        });
    }
    updateAccount(passwordStatus) {
        return new Promise(async (resolve, reject) => {
            try {
                const { Account } = require('./models/accounts');
                const account = await Account.findById(this.dataSource.account._id);
                if (!account) return resolve();

                account.passwordStatus = passwordStatus;

                return resolve(account.save());
            } catch (e) {
                return reject(e);
            }
        });
    }

    checkHasReservation() {
        return new Promise(async (resolve, reject) => {
            try {
                await this.page.goto('https://foreupsoftware.com/index.php/booking/19765#/account/reservations');
                const result = await this.page.evaluate((facilityArray) => {
                    if (USER.reservations && USER.reservations.length > 0) {
                        var resultFlag = false;
                        USER.reservations.forEach(reserv => {
                            if (facilityArray.find(f => f && f.key === reserv.teesheet_id))
                                resultFlag = true;
                        });
                        return resultFlag;
                    }
                    return false;
                }, this.facilityArray);

                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }

    checkOutofDate() {
        let result = false;
        if (this.dataSource instanceof BookingSchedule) {
            const highLimitedHour = moment(this.settings.bookingTargetDateTime).add(45, 'm').toDate();
            if (highLimitedHour < new Date()) {
                this.failedMessage = 'There is no tee time on target date or settings is not correct.';
                result = true;
            }
        } else {
            if (moment(DateMethods.toUTCDate(this.dataSource.toDate)).add(-1, 'd').toDate() < this.settings.monitoringExpireDate
                && moment(new Date()).add(-1, 'd').toDate() > this.settings.monitoringExpireDate) {
                this.failedMessage = 'The date range expired and no tee time found!';
                result = true;
            }
        }
        if (result)
            this.emit('changeStatus', 'outofdate', this.failedMessage);

        return result;
    }

    continuousStart() {
        if (this.checkOutofDate())
            return;

        this.checkLogin()
            .then(logged_in => {
                if (logged_in) {
                    return this.openTeeTimePage();
                } else {
                    return this.process();
                }
            })
            .then(async (continueChain) => {
                if (!continueChain)
                    return;

                return this.checkFacility(0, this.facilityArray.map(item => item.key));
            })
            .then((reserved) => {
                if (reserved === false) {
                    const self = this;
                    setTimeout(function () {
                        self.continuousStart();
                    }, self.bookingIntervalMillisecond);
                } else if (reserved === true) {
                    console.log('reserved!');
                    this.emit('changeStatus', 'successful', '');
                }
            })
            .catch(err => {
                console.error(err);
                this.startProcess();
            });
    }
    checkFacility(facilityIndex, facilityArray) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            try {
                if (facilityIndex < facilityArray.length) {
                    let checkingTimesResult = null;
                    if (this.dataSource instanceof BookingSchedule) {
                        const bookingTargetDateTime = this.settings.bookingTargetDateTime;
                        if (bookingTargetDateTime > new Date()) {
                            const bookingTargetDateTimeSeconds = bookingTargetDateTime.getTime() - (30 * 1000);
                            while (bookingTargetDateTimeSeconds - new Date().getTime() > 1000 * 30)
                                await sleep(1000 * 25);

                            await sleep(bookingTargetDateTimeSeconds - new Date().getTime());
                        }

                        checkingTimesResult = this.checkingTimes(facilityArray[facilityIndex], new Date(this.dataSource.targetDate), new Date(this.dataSource.targetDate), 60 * 1000);
                    } else {
                        const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                        let fromDate = new Date(this.dataSource.fromDate);
                        if (fromDate < today) fromDate = today;

                        let toDate = new Date(this.dataSource.toDate);
                        const maxDate = DateMethods.userToday();
                        maxDate.setDate(maxDate.getDate() + (this.settings.openTeeTimes || 7));
                        if (toDate > maxDate) toDate = maxDate;

                        checkingTimesResult = this.checkingTimes(facilityArray[facilityIndex], toDate, fromDate, 0);
                    }
                    checkingTimesResult.then((reserved) => {
                        if (reserved)
                            return resolve(true);
                        else
                            return resolve(this.checkFacility(facilityIndex + 1, facilityArray));
                    }).catch(error => {
                        reject(error);
                    });
                } else {
                    resolve(false);
                }
            } catch (e) {
                return reject(e);
            }
        });
    }
    checkingTimes(facilityKey, toDate, fromDate, innerTimeout) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            try {
                if (fromDate <= toDate) {
                    self.lastRecievedTimes = null;
                    await self.setPageParameter(facilityKey, fromDate, 4);
                    
                    let timeFrom = new Date(new Date().toLocaleDateString() + " " + self.dataSource.timeFrom);
                    let timeTo = new Date(new Date().toLocaleDateString() + " " + self.dataSource.timeTo);
                    timeFrom = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), timeFrom.getHours(), timeFrom.getMinutes(), 0, 0);
                    timeTo = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), timeTo.getHours(), timeTo.getMinutes(), 0, 0);

                    self.lastStatusTime = new Date();
                    self.lastRecievedTime_Contiue = null;
                    self.lastRecievedTime_hasItem = null;

                    await this.page.evaluate((timeFrom, timeTo, timeout) => {
                        window.StartMonitoring(timeFrom, timeTo, timeout);
                    }, timeFrom, timeTo, innerTimeout);

                    const reserved = await self.reserveTeeTime(innerTimeout);
                    if (reserved) return resolve(reserved);

                    fromDate.setUTCDate(fromDate.getUTCDate() + 1);
                    return resolve(await self.checkingTimes(facilityKey, toDate, fromDate, innerTimeout));
                } else {
                    return resolve(false);
                }
            } catch (e) {
                return reject(e);
            }
        });
    }
    reserveTeeTime(innerTimeout) {
        return new Promise(async (resolve, reject) => {
            const self = this;
            try {
                /*let timeItems = null;
                if (index >= 0) {
                    timeItems = await this.page.$x(`(//ul[@id="times"]/li)[${ (index + 1) }]`);
                    try {
                        if ( timeItems.length > 0 && await this.checkTimeLimitation(timeItems[0]) )
                            var timeItem = timeItems[0];                        
                    } catch(e) { }
                }

                if (!timeItem){
                    timeItems = await this.page.$x(`//ul[@id="times"]/li`);
                    for( let item of timeItems)
                        try {
                            if ( await this.checkTimeLimitation(item) )
                            {
                                var timeItem = item;                        
                                break;
                            }    
                        } catch (e) { }
                }

                if (!timeItem)
                    return resolve(false);
                
                try {
                    await timeItem.click();
                    */
                if (innerTimeout < 1000 * 15)
                    innerTimeout = 1000 * 15;
                const startTime = Date.now();
                while (Date.now() - startTime < innerTimeout) {
                    try {
                        await this.page.waitForXPath('//*[@id="book_time"]//*[@id="recaptcha"]', { visible: true, timeout: 1000 });
                        break;
                    } catch (e) {
                        if (new Date().getTime() - self.lastStatusTime.getTime() > innerTimeout) return resolve(false);
                        if (self.lastRecievedTime_Contiue === false && self.lastRecievedTime_hasItem === false) break;
                        await sleep(100); // Short sleep to prevent CPU overuse
                    }
                }

                let dialog = await this.page.$('#book_time');
                if (!(dialog && await isVisible(this.page, '//*[@id="book_time"]')))
                    return resolve(false);

                try {
                    let dialogPos = await this.page.evaluate((dialog) => {
                        const { top, left } = dialog.getBoundingClientRect();
                        return { top, left };
                    }, dialog);
                    await this.page.mouse.move(dialogPos.left + 5, dialogPos.top + 5);
                    await this.page.hover("#book_time");
                    await sleep(1500);
                    await this.page.hover("#recaptcha");
                    await sleep(1500);
                    await this.page.hover("button.book");
                    await sleep(1500);
                } catch (e) {
                    await sleep(2000);
                }
                await sleep(3000);
                try {
                    await this.page.click('#book_time .modal-footer .js-book-button');
                    await sleep(50);
                } catch (e) {
                    console.error('Error in finding button');
                    await sleep(3000 * 5);
                    await this.page.evaluate(() => {
                        $('#book_time .book,#book_time .btn-success').click();

                    });
                }

                const recaptchaXPath = `//*[@id="rc-imageselect"]|//*[@id="recaptcha-verify-button"]|//iframe[contains(@title, 'recaptcha challenge')]`;
                await this.page.waitForXPath(`//h1[contains(., 'Congratulations')]|//h3[contains(., 'Reservation Details')]|${recaptchaXPath}`, { visible: true, timeout: 1000 * 60 });
                if (await isVisible(this.page, recaptchaXPath)) {
                    console.log(new Date(), 'Captcha detected');
                    this.status = 'captcha';
                    this.failedMessage = 'Chaptcha detected';
                    this.emit('changeStatus', this.status, '');
                    const captchaResult = await Promise.race([
                        this.page.waitForXPath(`//h1[contains(., 'Congratulations')]|//h3[contains(., 'Reservation Details')]`, { visible: true, timeout: 30000 }),
                        new Promise(resolve => setTimeout(() => resolve('timeout'), 30000))
                    ]);
                    if (captchaResult !== 'timeout') {
                        return resolve(true);
                    } else {
                        console.log(new Date(), 'Full reset');
                        await self.fullReset();
                        return resolve(false);
                    }
                } else {
                    return resolve(true);
                }
            } catch (e) {
                console.error(new Date(), 'reserver failed');
                console.log(e);
                return resolve(false);
            }
        });
    }
    checkTimeLimitation(timeItem) {
        return new Promise(async (resolve, reject) => {
            const self = this;
            try {
                const startTime = await timeItem.$$eval('.start', (nodes) => nodes.map((n) => n.innerText).reduce((val1, val2) => v1 + ' ' + v2));
                const isPM = startTime.toLowerCase().includes('pm');
                const timeParts = startTime.replace(/[^\d\:]/gm, '').split(':').map(item => parseInt(item));

                const timeInMinutes = (timeParts[0] * 60) + timeParts[1] + (isPM ? 12 * 60 : 0);
                const result = timeInMinutes >= this.timeFromInMinutes && timeInMinutes <= this.timeToInMinutes;
                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }
    openTeeTimePage() {
        return new Promise(async (resolve, reject) => {
            const self = this;
            try {
                const pageIsReady = await this.page.evaluate(() => {
                    return window.onTeeTimesUpdate &&
                        $('#date-field,#schedule_select').length > 0;
                });
                if (pageIsReady) return resolve(true);

                await this.page.goto('https://foreupsoftware.com/index.php/booking/19765#/teetimes');
                await this.page.waitForSelector(".navbar-brand", { visible: true, timeout: 1000 * 60 });

                try {
                    await this.page.waitForXPath("//button[contains(., 'Verified NYS Resident')]", { visible: true, timeout: 1000 * 30 });
                } catch (e) {
                    try {
                        await this.page.click('a[href~="#/teetimes"]');
                        await this.page.waitForXPath("//button[contains(., 'Verified NYS Resident')]", { visible: true, timeout: 1000 * 10 });
                    } catch (e) { }
                }
                await this.page.evaluate(() => $('button.btn:contains("Verified NYS Resident"):first').click());
                try {
                    await this.page.waitForXPath("//div[contains(., 'Your account has been disabled')]", { visible: true, timeout: 100 * 0.5 });
                    await this.updateAccount("Inactive");

                    this.status = 'failed';
                    this.failedMessage = "This account has been disabled";
                    this.emit('changeStatus', this.status, this.failedMessage);
                    return;
                } catch (e) {
                }
                await this.page.waitForSelector("#date-field,#schedule_select", { visible: true, timeout: 1000 * 5 });
                const aleardyExists = await this.page.evaluate(() => {
                    return (typeof TimeView.prototype.createPendingBase !== 'undefined');
                });

                if (aleardyExists)
                    return resolve(true);

                await this.page.evaluate(() => {
                    if (TimeView.prototype.createPendingBase)
                        return true;

                    /*App.data.times.on('update', () => {
                        setTimeout(function(){
                            window.onRecieveTimes({message: App.data.times.message, models: App.data.times.models});
                        },100);
                    });
                     
                    $.ajaxBase = $.ajax;
                    $.ajax = function(t,n){
                        if (t.async === false && t.url && t.url.indexOf('pending_reservation') > 0)
                            t.async = true;
                        return $.ajaxBase(t,n);
                    };*/

                    window.StartMonitoring = function (timeFrom, timeTo, timeout = 1000 * 60) {
                        console.log('StartMonitoring Method');
                        if ($('#book_time:visible,.js-book-button:contains("Book Time"):visible').length > 0)
                            return;
                        window.timeFrom = new Date(timeFrom);
                        window.timeTo = new Date(timeTo);
                        window.endMonitoring = new Date().getTime() + timeout;
                        //window.pendingReservationFound = false;
                        //window.reservations = new Array();

                        $('.players a.active').trigger('click');
                    }

                    App.data.times.on('sync', () => {
                        console.log('update event');
                        let Contiue = false;
                        if (!window.pendingReservationFound
                            && (window.endMonitoring >= new Date().getTime())
                            && (!App.data.times.message || App.data.times.message.indexOf('Booking for') >= 0)
                            && !(App.data.times.models != null && App.data.times.models.length > 0)) {
                            setTimeout(() => {
                                $('.players a.active').trigger('click');
                            }, 10);
                            Contiue = true;
                        }

                        let hasItem = false;
                        if ($('#SelectedTime').trigger('click').length > 0) {
                            hasItem = true;
                        }

                        window.onTeeTimesUpdate(Contiue, hasItem);
                    });

                    window.reservationTimeout = null;
                    window.currentReservation = null;
                    window.clearReservTimeout = () => {
                        clearTimeout(window.reservationTimeout);
                        window.reservationTimeout = null;
                    }

                    window.reservations = new Array();

                    window.CheckReservation = function () {
                        if (!window.reservations.length)
                            return;

                        if (window.pendingReservationFound)
                            return;

                        if (window.reservationTimeout)
                            return;

                        if (window.currentReservation)
                            return;

                        window.currentReservation = window.reservations.pop();
                        //console.log('setTimeout');
                        window.reservationTimeout = setTimeout(() => {
                            window.clearReservTimeout();
                            window.currentReservation = null;
                            if (!window.pendingReservationFound)
                                window.CheckReservation();
                        }, 10 * 1000);


                        const { timeTileView, attributes } = window.currentReservation;
                        console.log("currentReservation: ", window.currentReservation);
                        App.data.analytics.dispatchEvent('teetimeClicked', attributes);
                        if (!App.data.course.hasFeature('2022-09-honeybadgers-online-booking-reservation-details')) {
                            const res = timeTileView.viewTimeDeprecated(attributes)
                            return res.done(function (response) {
                                window.pendingReservationFound = window.currentReservation;
                                window.clearReservTimeout();
                                window.currentReservation = null;
                                console.log('success');
                                return true;
                            }).fail(function (response) {
                                console.log('failed');

                                window.pendingReservationFound = null;
                                window.clearReservTimeout();
                                window.currentReservation = null;
                                window.CheckReservation();
                                return false;
                            });
                        }

                        var pendingReservation = timeTileView.createPending(attributes);
                        App.vent.trigger("updateReservationData", {
                            reservationData: attributes
                        });

                        return pendingReservation.done(function (response) {
                            window.pendingReservationFound = true;
                            window.clearReservTimeout();
                            window.currentReservation = null;
                            console.log('success')

                            window.onlineBookingVueFactory.dataStore.dispatch('reservation/updatePendingReservation', response);
                            if (response.original_tee_time) {
                                window.onlineBookingVueFactory.dataStore.dispatch('reservation/updateOriginalTeeTime', response.original_tee_time);
                            }
                            App.router.navigateTo('/book_time');
                            // Success
                            return true;
                        }).fail(function (response) {
                            window.pendingReservationFound = null;
                            console.log('failed');
                            if (response.type === 'noFeature') {//TODO-asg: move logic in updatePendingReservation;
                                //this.updatePendingReservation(reservation, pendingReservationTimer, response);
                                // new BookingTimeModalView({
                                //     model: reservation,
                                //     pendingReservationTimer: pendingReservationTimer,
                                // }).show();
                            } else {
                                console.error(response);
                                //TODO-asg: lets try to show a better error here
                                App.ventErrorMessage('Sorry, that teetime is no longer available');
                                App.data.times.refresh();
                            }
                            window.clearReservTimeout();
                            window.currentReservation = null;
                            window.CheckReservation();
                            return false;
                        });

                    }

                    window.AddReservation = function (timeTileView, attributes) {
                        console.log("AddReservation Method");
                        window.reservations.push({ timeTileView, attributes });

                        if (!window.reservationTimeout)
                            window.CheckReservation();

                    }

                    TimeTileView.prototype.renderBase = TimeTileView.prototype.render;
                    TimeTileView.prototype.render = function (teeTimeFromUrl) {
                        console.log('render Method');
                        var self = this;
                        const itemDateTime = new Date(self.model.attributes.time);
                        if (App.data.filters.get('players') == 4 && (itemDateTime >= window.timeFrom && itemDateTime <= window.timeTo)) {
                            //console.log(itemDateTime, self.model.attributes);
                            this.$el.data(self);
                            var attributes;
                            if (teeTimeFromUrl && typeof teeTimeFromUrl.attributes !== 'undefined') {
                                attributes = _.clone(teeTimeFromUrl.attributes);
                            } else {
                                attributes = _.clone(this.model.attributes);
                            }
                            if (attributes.available_spots == 0) {
                                return Promise.resolve(false);
                            }
                            attributes.players = attributes.available_spots;
                            if (Feature.isActive('2022-07-phoenix-DEV-11688-reservation-group-hierarchy')) {
                                attributes.booking_class_id = App.data.filters.get('booking_class');
                            }

                            if (attributes.players == 0) {
                                attributes.players = 1;
                            }

                            if (FACILITY_SETTINGS.oneReservationPerTimeslot) {
                                attributes.holes = 9;
                                attributes.players = 4;
                            }
                            setTimeout(() => window.AddReservation(self, attributes), 1);

                            setTimeout(() => self.renderBase(teeTimeFromUrl), 200);
                        }
                        return this;
                    }

                    TimeView.prototype.createPendingBase = TimeView.prototype.createPending;
                    TimeView.prototype.createPending = function (attributes) {
                        if (this.pendingReservation)
                            return this.pendingReservation;
                        else
                            return (this.pendingReservation = this.createPendingBase(attributes));
                    };

                    TimeView.prototype.renderBase = TimeView.prototype.render;
                    TimeView.prototype.render = function () {
                        var self = this;
                        const itemDateTime = new Date(self.model.attributes.time);
                        console.log(itemDateTime, self.model.attributes);
                        if (!window.pendingReservationFound && App.data.filters.get('players') == 4 && (itemDateTime >= window.timeFrom && itemDateTime <= window.timeTo)) {
                            this.$el.data(self);
                            var attributes = _.clone(self.model.attributes);

                            if (attributes.available_spots == 0) {
                                return false;
                            }

                            attributes.players = App.data.filters.get('players');
                            attributes.holes = App.data.filters.get('holes');

                            if (attributes.players == 0) {
                                attributes.players = 1;
                            }

                            if (FACILITY_SETTINGS.oneReservationPerTimeslot) {
                                attributes.holes = 9;
                                attributes.players = 4;
                            }

                            App.data.analytics.dispatchEvent('teetimeClicked', attributes); // Create new reservation defaulted to filter settings
                            //console.log('sending',window.lasttime - new Date().getTime(), window.lasttime = new Date().getTime());
                            var pendingReservation = self.createPending(attributes).responseJSON;
                            //console.log('Reserved',window.lasttime - new Date().getTime(), new Date().getTime());
                            console.log(pendingReservation);
                            if (window.pendingReservationFound = pendingReservation.success) {
                                const returnvalue = this.renderBase();
                                this.$el.attr('id', 'SelectedTime');
                                return returnvalue;
                            }
                        }
                        return this;
                    }
                });


                function onTeeTimesUpdate(Contiue, hasItem) {
                    self.onTeeTimesUpdate(Contiue, hasItem);
                }

                try {
                    await this.page.exposeFunction('onTeeTimesUpdate', onTeeTimesUpdate);
                } catch (e) { }

                await this.page.evaluate(() => {
                    (function () {

                        function setFocus() {
                            setTimeout(function () {
                                self[hidden] = false;
                                $(window).trigger('focus');
                                $(document).trigger('focus');
                                $(self).trigger('focus');
                            }, 500);
                        }
                        var self = window;
                        var hidden = "hidden";
                        // Standards:
                        if (hidden in document)
                            document.addEventListener("visibilitychange", onchange);
                        else if ((hidden = "mozHidden") in document)
                            document.addEventListener("mozvisibilitychange", onchange);
                        else if ((hidden = "webkitHidden") in document)
                            document.addEventListener("webkitvisibilitychange", onchange);
                        else if ((hidden = "msHidden") in document)
                            document.addEventListener("msvisibilitychange", onchange);
                        // IE 9 and lower:
                        else if ("onfocusin" in document)
                            document.onfocusin = document.onfocusout = onchange;
                        // All others:
                        else
                            window.onpageshow = window.onpagehide
                                = window.onfocus = window.onblur = onchange;

                        function onchange(evt) {
                            var v = "visible", h = "hidden",
                                evtMap = {
                                    focus: v, focusin: v, pageshow: v, blur: h, focusout: h, pagehide: h
                                };

                            evt = evt || window.event;
                            if (evt.type in evtMap) {
                                //console.log("evtMap[evt.type]", evtMap[evt.type]);
                                document.body.className = evtMap[evt.type];
                            } else {
                                self = this;
                                console.log("this[hidden]", hidden, this[hidden]);
                                //document.body.className = this[hidden] ? "hidden" : "visible";
                                if (!this[hidden])
                                    setFocus();
                            }
                        }

                        $(window).blur(function () {
                            //console.log('blur');
                            setFocus();
                        });

                        // set the initial state (but only if browser supports the Page Visibility API)
                        if (document[hidden] !== undefined)
                            onchange({ type: document[hidden] ? "blur" : "focus" });
                    })();

                });

                return resolve(true);
            } catch (e) {
                return reject(e);
            }
        });
    }

    setPageParameter(facilityKey, date, players, timeOfDay, holes, showSpecialOnly) {
        return new Promise(async (resolve, reject) => {
            try {
                if (facilityKey) { /* 2517, 2431, 2433, 2539, 2538, 2434, 2432, 2435 */
                    await this.page.evaluate((facilityKey) => {
                        if ($('#schedule_select').val() !== facilityKey) $('#schedule_select').val(facilityKey).trigger('change');
                    }, facilityKey);
                }

                if (date) { /* mm-dd-yyyy */
                    if (typeof (date) !== String)
                        date = (date.getMonth() + 1).toString() + "-" + date.getDate().toString() + "-" + date.getFullYear().toString();

                    await this.page.evaluate((date) => {
                        if ($('#date-field').val() !== date) $('#date-field').val(date).trigger('change');
                    }, date);
                }

                if (players) { /* 1, 2, 3, 4 */
                    await this.page.evaluate((players) => {
                        if (!$('.players [data-value="' + players + '"]').hasClass('active')) $('.players [data-value="' + players + '"]').click()
                    }, players);
                }

                if (timeOfDay) { /* morning, midday, evening, all */
                    await this.page.evaluate((timeOfDay) => {
                        if (!$('.time [data-value="' + timeOfDay + '"]').hasClass('active')) $('.time [data-value="' + timeOfDay + '"]').click()
                    }, timeOfDay);
                }

                if (holes) { /* 18 */
                    await this.page.evaluate((holes) => {
                        if (!$('.holes [data-value="' + timeOfDay + '"]').hasClass('active')) $('.holes [data-value="' + timeOfDay + '"]').click()
                    }, holes);
                }

                if (showSpecialOnly) { /* true, false */
                    await this.page.evaluate((showSpecialOnly) => {
                        if ($('[name="specials_only"]').prop('checked') !== showSpecialOnly) $('[name="specials_only"]').trigger('click');
                    }, showSpecialOnly);
                }

                return resolve();
            } catch (e) {
                return reject(e);
            }
        });
    }

    onRecieveTimes(self, times) {
        self.lastRecievedTimes = times;
        //console.log(self, times);
    }
    onTeeTimesUpdate(Contiue, hasItem) {
        //console.log(Contiue, hasItem);
        this.lastRecievedTime_Contiue = Contiue;
        this.lastRecievedTime_hasItem = hasItem;
        this.lastStatusTime = new Date();
    }
};

module.exports = BookingBot;