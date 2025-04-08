(function($){
    $(document).ready(function(){

        const refreshDatatable = function(){
            $dataTable.ajax.reload();
        };

        $(document).on('click','.btnDeleteAccount',function(e){
            e.preventDefault();
            if(!confirm('Do you want to delete this account with all history and booking schedule?'))
                return false;
            
                $.ajax({
                    method:"DELETE",
                    url:"./api/accounts/" + $(this).val(),
                    contentType: "application/json",
                    dataType: "json",
                    success: function(response) {
                        if (typeof response === 'object' && response._id)
                        {
                            showWarning("Account deleted successfully.",'success');
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
                    url:"./api/accounts/list/",
                    contentType: "application/json",
                    dataType: "json",
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
                { "data": "label" },
                { "data": "username" },
                { "data": "passwordStatus" },
                { "data": "_id" },
            ],
            "columnDefs": [
                {
                    "render": function ( data, type, row ) {
                        switch (data){
                            case 'verified':
                                return '<span class="text-success"><i class="fas fa-check-circle"></i>&nbsp;Verified</span>';
                            case 'Invalid':
                                return '<span class="text-danger"><i class="fas fa-times-circle"></i>&nbsp;Invalid</span>';
                            case 'Inactive':
                                return '<span class="text-danger"><i class="fas fa-times-circle"></i>&nbsp;Account is inactive</span>';
                            default:
                                return '<span class="text-primary"><i class="fas fa-sync-alt"></i>&nbsp;Pending</span>';
                        }
                    },
                    "targets": 2
                }, {
                    "render": function ( data, type, row ) {
                        return '<button class="btn btn-info btnDeleteAccount" title="Delete Account" value="'+ data +'"><i class="fas fa-trash"></i></button>' +
                            '<a class="btn btn-success" style="margin-left: 3px;" title="Edit Acount" href="./editaccount?_id='+ data +'" ><i class="fas fa-pen"></i></a>';
                    },
                    "targets": 3
                }
            ]
        });
        
    });
})(jQuery);