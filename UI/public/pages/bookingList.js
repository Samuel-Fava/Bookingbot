(function($){
    $(document).ready(function(){

        if (location.hash === '#pending')
            $('#selectStatusFilter').val('pending,inprogress,captcha');
        if (location.hash === '#failed')
            $('#selectStatusFilter').val('failed,outofdate');
        if (location.hash === '#successful')
            $('#selectStatusFilter').val('successful');

        const refreshDatatable = function(){
            $dataTable.ajax.reload();
        };

        $('#btnRefreshGrid').click(function () {
            refreshDatatable();
        });
        
        $(document).on('click','.btnDeleteBookingSchedule',function(e){
            e.preventDefault();
            if(!confirm('Do you want to delete this booking schedule?'))
                return false;
            
                $.ajax({
                    method:"DELETE",
                    url:"./api/bookingShedules/" + $(this).val(),
                    contentType: "application/json",
                    dataType: "json",
                    success: function(response) {
                        if (typeof response === 'object' && response._id)
                        {
                            showWarning("Booking deleted successfully.",'success');
                            refreshDatatable();
                        }
                        else{
                            showWarning(response.responseText || response);
                        }
                    },
                    error: function(response) {
                        showWarning(response.responseText || response);
                        console.log(response);
                    }
                }); 

            return false;
        });
        
        const $dataTable = $('#dataTable').DataTable({
            "ajax": function (data, callback, settings) {
                $.ajax({
                    method:"GET",
                    url:"./api/bookingShedules/list/" + $('#selectStatusFilter').val() ,
                    contentType: "application/json",
                    dataType: "json",
                    data: {
                        date: $('#inputBookingDate').val(),
                        dateOprator: $('#selectDateOprator').val(),
                        dateField: $('#selectDateField').val()
                    },
                    success: function(response) {
                        if (typeof response === 'object' && response.data)
                        {
                            callback(response);
                        }
                        else{
                            showWarning(response.responseText || response);
                        }
                    },
                    error: function(response) {
                        showWarning(response.responseText || response);
                        console.log(response);
                    }
                }); 
            },
            "columns": [
                { "data": "account" },
                { "data": "targetDate" },
                { "data": "launchDate" },
                { "data": "timeFrom" },
                { "data": "timeTo" },
                { "data": "status" },
                { "data": "_id" },
            ],
            "columnDefs": [
                {
                    "render": function ( data, type, row ) {
                        return ( (data && data.label ? data.label +' ('+ data.username +')': (data && date.username ? data.username: null)) || "Unknown" ) +
                            '<ul>' + row.facilities.reduce( (res, item) => res + '<li>' + item.title + '</li>', "" ) +'</ul>';
                    },
                    "targets": 0
                },{
                    "render": function ( data, type, row ) {
                        return formatDate(data);
                    },
                    "targets": [1, 2]
                },{
                    "render": function ( data, type, row ) {      
                        
                        switch (data){
                            case 'outofdate':
                                return '<span class="text-danger"><i class="fas fa-times-circle"></i>&nbsp;Out of date</span>'  + '<br />' + row.statusMessage;;
                            case 'pending':
                                return '<span class="text-primary"><i class="fas fa-sync-alt"></i>&nbsp;Pending</span>';
                            case 'captcha':
                                return '<span class="text-primary"><i class="fas fa-sync-alt"></i>&nbsp;Captcha detected</span>';
                            case 'inprogress':
                                return '<span class="text-primary"><i class="fas fa-sync-alt"></i>&nbsp;In progress</span>';
                            case 'failed':                                    
                                return '<span class="text-danger"><i class="fas fa-times-circle"></i>&nbsp;Failed</span>' + '<br />' + row.statusMessage;;
                            case 'successful':
                                return '<span class="text-success"><i class="fas fa-check-circle"></i>&nbsp;Successful</span>';
                        }
                    },
                    "targets": 5
                },{
                    "render": function ( data, type, row ) {
                        return '<button class="btn btn-info btnDeleteBookingSchedule" value="'+ data +'"><i class="fas fa-trash"></button>'
                    },
                    "targets": 6
                }
            ]
        });



        $('#inputBookingDate')
            .attr('readonly', 'readonly').css('background-color','white')
            .datepicker({ dateFormat: "mm/dd/yy", changeMonth: true, changeYear: true, minDate: "-1Y", maxDate: "+1Y" })
            .change(refreshDatatable);

        $('#selectDateOprator, #selectDateField, #selectStatusFilter').change(refreshDatatable);
    });
})(jQuery);