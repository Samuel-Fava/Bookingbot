
(function($){
    $(document).ready(function(){
        $('.datePicker').attr('readonly', 'readonly').css('background-color','white')
            .datepicker({ dateFormat: "mm/dd/yy", changeMonth: true, changeYear: true, minDate: "0", maxDate: "+1Y" });

        $('.timePicker').mdtimepicker({
            readOnly:true, 
            clearBtn:false,
            hourPadding:false,
            is24hour: true,
        }).css('background-color','white');

        $('#facilityList #facilityList-all').change(function(){
            $('#facilityList input:not(#facilityList-all)').prop('checked',$(this).prop('checked'));            
        });

        $('#selectAccount').select2({
            placeholder: "Create a new account",
            allowClear: true,
            ajax: {
                url: './api/accounts',
                dataType: 'json',
                delay: 250,
                processResults: function (data) {    
                    data.results = data.results.map((item)=>{ return {id: item._id, text: (item.label ? item.label + " (" +item.username + ")" : item.username) } });
                    return data;
                }
            }            
        }).on('change',function(){            
            if ($(this).val())
                $('.newAccountPanel').slideUp();
            else
                $('.newAccountPanel').slideDown();
        }).change();

        $('#createButton').click(function(e){
            e.preventDefault();
            if (!$('#selectAccount').val()){
                if ($('#inputUsername').val().length < 3){
                    $('#inputUsername').focus()
                    showWarning("Please enter a username.");
                    return false;        
                }
                if ($('#inputPassword').val().length < 3){
                    $('#inputPassword').focus();
                    showWarning("Please enter a password.");
                    return false;
                }
            }
            if (!$('#inputFromDate').val()){
                showWarning("Please enter a start date for monitoring.");
                return false;
            }

            if (!$('#inputToDate').val()){
                showWarning("Please enter an end date for monitoring.");
                return false;
            }


            if (!$('#inputFromTime').val()){
                showWarning("Please enter a FROM hour.");
                return false;
            }

            if (!$('#inputToTime').val()){
                showWarning("Please enter a TO hour.");
                return false;
            }

            /// AJAX save
            const saveBookingSchedule = function(){
                $.ajax({
                    method:"POST",
                    url:"./api/cancelationMonitoring",
                    contentType: "application/json",
                    dataType: "json",
                    data: JSON.stringify({
                        accountId: $('#selectAccount').val(),
                        fromDate: $('#inputFromDate').val(),
                        toDate: $('#inputToDate').val(),
                        timeFrom: $('#inputFromTime').val(),
                        timeTo: $('#inputToTime').val(),
                        facilities: $('#facilityList input:checked:not(#facilityList-all)').map(function(){ return $(this).val(); }).get()
                    }),
                    success: function(response) {
                        if (typeof response === 'object' && response._id)
                        {
                            showWarning('Cancelation monitoring saved successfully','success');
                            $('#inputFromDate').val('');
                            $('#inputToDate').val('');
                            $('#inputFromTime').val('');
                            $('#inputToTime').val('');
                        }
                        else{
                            showWarning(response.responseText || response);
                        }
                        $('#createButton').removeAttr('disabled');
                    },
                    error: function(response) {
                        showWarning(response.responseText || response);
                        console.log(response);
                        $('#createButton').removeAttr('disabled');
                    }
                });  
                $('#createButton').removeAttr('disabled');
            };

            $(this).attr('disabled','disabled');

            if (!$('#selectAccount').val()){
                $.ajax({
                    method:"POST",
                    url:"./api/accounts",
                    contentType: "application/json",
                    dataType: "json",
                    data: JSON.stringify({
                        label: $('#inputLabel').val(),
                        username: $('#inputUsername').val(),
                        password: $('#inputPassword').val()
                    }),
                    success: function(response) {
                        if (typeof response === 'object' && response._id)
                        {
                            $('#selectAccount').append('<option value="'+ response._id +'">'+ (response.label ? response.label + " (" +response.username + ")" : response.username) +'</option>').val(response._id).trigger("change");
                            saveBookingSchedule();
                        }
                        else{
                            showWarning(response.responseText || response);
                            $('#createButton').removeAttr('disabled');
                        }
                    },
                    error: function(response) {
                        showWarning(response.responseText || response);
                        console.log(response);
                        $('#createButton').removeAttr('disabled');
                    }
                });           
            }
            else
                saveBookingSchedule();
            
            return false;

        });

        
    });
})(jQuery);