(function($){
    $(document).ready(function(){
        const $selectTimezone = $('#selectTimezone');
        const allTimezones = ct.getAllTimezones();
        for (let tz in allTimezones){
            $('<option value="'+ allTimezones[tz].name +'">'+ allTimezones[tz].name + " ("+ allTimezones[tz].utcOffsetStr +')</option>').appendTo($selectTimezone).data(allTimezones[tz]);
        };

        $selectTimezone.select2({
            placeholder: "Select your time zone",
        }).on('change',function(){            
            
        });

        $('.timePicker').mdtimepicker({
            readOnly:true, 
            clearBtn:false,
            hourPadding:false,
            is24hour: true,
        }).css('background-color','white');
        $('#inputBookingStartBefore').spinner().parent().css('width','40%');

        $.ajax({
            method:"GET",
            url:"./api/settings/",
            contentType: "application/json",
            dataType: "json",
            success: function(response) {
                if (typeof response === 'object' && response._id)
                {
                    $selectTimezone.val(response.userTimezone).trigger("change");
                    $('#inputBookingTime').val(response.bookingTargetTime);
                    $('#inputBookingStartBefore').val(response.startBefore);
                    $('#inputOpenTeeTimes').val(response.openTeeTimes);                    
                    $('#inputMonitoringInterval').val(response.monitoringInterval);                    
                }
                else{
                    showWarning(response.responseText || response);
                    $('#saveButton').attr('disabled','disabled');
                }
            },
            error: function(response) {
                showWarning(response.responseText || response);
                $('#saveButton').attr('disabled','disabled');
                console.log(response);
            }
        }); 

        $('#saveButton').click(function(e){
            e.preventDefault();

            $.ajax({
                method:"PUT",
                url:"./api/settings/",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({
                    userTimezone: $selectTimezone.val(),
                    userTimezoneOffset: $('#selectTimezone :selected').data().utcOffsetStr,
                    bookingTargetTime: $('#inputBookingTime').val(),
                    startBefore: parseInt($('#inputBookingStartBefore').val()),
                    openTeeTimes: parseInt($('#inputOpenTeeTimes').val()),
                    monitoringInterval: parseInt($('#inputMonitoringInterval').val())
                }), 
                success: function(response) {
                    if (typeof response === 'object' && response._id)
                    {
                        showWarning('Settings saved successfully.','success');
                    }
                    else{
                        showWarning(response.responseText || response);
                        $('#saveButton').attr('disabled','disabled');
                    }
                },
                error: function(response) {
                    showWarning(response.responseText || response);
                    $('#saveButton').attr('disabled','disabled');
                    console.log(response);
                }
            }); 
            
            return false;
        });
    });
})(jQuery);