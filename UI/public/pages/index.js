(function($){
    $(document).ready(function(){

        $.ajax({
            method:"GET",
            url:"./api/statistics/",
            contentType: "application/json",
            dataType: "json",
            success: function(response) {
                if (typeof response === 'object')
                {
                    $('#statistics-pending-today').html((response.pending.today || 0) + (response.inprogress.today || 0) + (response.captcha.today || 0));
                    $('#statistics-pending-total').html((response.pending.total || 0) + (response.inprogress.total || 0) + (response.captcha.total || 0));

                    $('#statistics-failure-today').html((response.failed.today || 0) + (response.outofdate.today || 0));
                    $('#statistics-failure-total').html((response.failed.total || 0) + (response.outofdate.total || 0));

                    $('#statistics-success-today').html((response.successful.today || 0));
                    $('#statistics-success-total').html((response.successful.total || 0));

                    $('#statistics-cancelation-active').html((response.cancelationMonitoring.active || 0));
                    $('#statistics-cancelation-total').html((response.cancelationMonitoring.total || 0));
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

        const refreshDatatable = function(){
            $dataTable.ajax.reload();
        };
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
        const today = new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0));

        const $dataTable = $('#bookingDataTable').DataTable({
            "ajax": function (data, callback, settings) {
                $.ajax({
                    method:"GET",
                    url:"./api/bookingShedules/list/pending,inprogress,captcha",
                    contentType: "application/json",
                    dataType: "json",
                    data: {
                        date: today,
                        dateOprator: 'gte',
                        dateField: 'launchDate'
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
                    "targets": 1
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
                    "targets": 4
                },{
                    "render": function ( data, type, row ) {
                        return '<button class="btn btn-info btnDeleteBookingSchedule" value="'+ data +'"><i class="fas fa-trash"></button>'
                    },
                    "targets": 5
                }
            ]
        });


    });
})(jQuery);