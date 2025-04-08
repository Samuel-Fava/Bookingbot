
(function($){
    $(document).ready(function(){
        $('#saveButton').attr('disabled','disabled');
        $.ajax({
            method:"GET",
            url:"./api/accounts/" + getParameterByName('_id'),
            contentType: "application/json",
            dataType: "json",            
            success: function(response) {
                if (typeof response === 'object' && response._id)
                {
                    $('#inputLabel').val(response.label);
                    $('#inputUsername').val(response.username);                    
                }
                else{
                    showWarning(response.responseText || response);
                }
                $('#saveButton').removeAttr('disabled');

            },
            error: function(response) {
                showWarning(response.responseText || response);
                console.log(response);
                $('#saveButton').removeAttr('disabled');
            }
        });   


        $('#saveButton').click(function(e){
            e.preventDefault();
            if ($('#inputUsername').val().length < 3){
                $('#inputUsername').focus()
                showWarning("Please enter a username.");
                return false;        
            }

            $(this).attr('disabled','disabled');

            $.ajax({
                method:"PUT",
                url:"./api/accounts/" + getParameterByName('_id'),
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
                        showWarning("Account changed successfully","success");
                    }
                    else{
                        showWarning(response.responseText || response);
                    }
                    $('#saveButton').removeAttr('disabled');

                },
                error: function(response) {
                    showWarning(response.responseText || response);
                    console.log(response);
                    $('#saveButton').removeAttr('disabled');
                }
            });           
            return false;
        });
    });
})(jQuery);