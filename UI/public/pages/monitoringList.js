(function($){
    $(document).ready(function(){

        if (location.hash === '#active')
            $('#selectStatusFilter').val('active,inprogress,captcha');
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

        $(document).on('click','.btnDeleteCancelationMonitoring',function(e){
            e.preventDefault();
            if(!confirm('Do you want to delete this task?'))
                return false;
            
                $.ajax({
                    method:"DELETE",
                    url:"./api/cancelationMonitoring/" + $(this).val(),
                    contentType: "application/json",
                    dataType: "json",
                    success: function(response) {
                        if (typeof response === 'object' && response._id)
                        {
                            showWarning("Task deleted successfully.",'success');
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

        
        $(document).on('click','.btnRefreshFailedCancelationMonitoring',function(e){
            e.preventDefault();
            if(!confirm('Do you want to refresh this task?'))
                return false;
            
                $.ajax({
                    method:"PUT",
                    url:"./api/cancelationMonitoring/refresh/" + $(this).val(),
                    contentType: "application/json",
                    dataType: "json",
                    success: function(response) {
                        if (typeof response === 'object' && response._id)
                        {
                            showWarning("Task refreshed successfully.",'success');
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
                    url:"./api/cancelationMonitoring/list/" + $('#selectStatusFilter').val() ,
                    contentType: "application/json",
                    dataType: "json",
                    data: {
                        date: $('#inputMonitoringDate').val(),
                        dateOprator: $('#selectDateOprator').val(),
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
                { "data": "fromDate" },
                { "data": "toDate" },
                { "data": "timeFrom"},
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
                    "targets": [1 , 2]
                },{
                    "render": function ( data, type, row ) {      
                        return row.timeFrom + " - " + row.timeTo;
                    },
                    "targets": 3
                },{
                    "render": function ( data, type, row ) {      
                        
                        switch (data){
                            case 'outofdate':
                                return '<span class="text-danger"><i class="fas fa-times-circle"></i>&nbsp;Out of date</span>' +
                                    '<br />'+ row.statusMessage;                                     

                            case 'active':
                                return '<span class="text-primary"><i class="fas fa-sync-alt"></i>&nbsp;Active</span>';
                            case 'inprogress':
                                return '<span class="text-primary"><i class="fas fa-sync-alt"></i>&nbsp;In progress</span>';
                            case 'captcha':
                                return '<span class="text-primary"><i class="fas fa-sync-alt"></i>&nbsp;Captcha detected</span>';
                            case 'failed':
                                let statusMessage = '';
                                if (new Date(row.toDate) >= new Date())
                                    statusMessage = '<button class="btn btn-info p-1 mx-1 btnRefreshFailedCancelationMonitoring" value="'+ row._id +'"><i class="fas fa-redo"></i></button>' +
                                        '<br />'+ row.statusMessage;                                     
                                return '<span class="text-danger"><i class="fas fa-times-circle"></i>&nbsp;Failed</span>' + statusMessage;
                            case 'successful':
                                return '<span class="text-success"><i class="fas fa-check-circle"></i>&nbsp;Successful</span>';
                        }
                    },
                    "targets": 4
                },{
                    "render": function ( data, type, row ) {
                        return '<button class="btn btn-info btnDeleteCancelationMonitoring" value="'+ data +'"><i class="fas fa-trash"></i></button>'
                    },
                    "targets": 5
                }
            ]
        });

        $('#inputMonitoringDate')
            .attr('readonly', 'readonly').css('background-color','white')
            .datepicker({ dateFormat: "mm/dd/yy", changeMonth: true, changeYear: true, minDate: "-1Y", maxDate: "+1Y" })
            .change(refreshDatatable);
        $('#selectDateOprator').change(refreshDatatable);
        $('#selectStatusFilter').change(refreshDatatable);
    });
})(jQuery);