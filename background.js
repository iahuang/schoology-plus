/**
 * Schoology version of $.ajax for performing AJAX POST call that is safe from CSRF attacks
 * @param params - similar parameters to be passed into jquery $.ajax
 */
let schoologySecureAjax = function (params) {
    var ret = null;
    if (
        typeof Drupal.settings.s_common.csrf_token != "undefined" &&
        typeof Drupal.settings.s_common.csrf_key != "undefined"
    ) {
        var tokenData = {
            "X-Csrf-Token": Drupal.settings.s_common.csrf_token,
            "X-Csrf-Key": Drupal.settings.s_common.csrf_key,
        };

        var allowedMethod = ["POST", "PUT", "DELETE"];
        if (
            typeof params.type == "undefined" ||
            allowedMethod.indexOf(params.type) == -1
        ) {
            params.type = "POST";
        }
        if (params.headers) {
            $.extend(params.headers, tokenData);
        } else {
            params.headers = tokenData;
        }
        ret = $.ajax(params);
    }
    return ret;
};


document.addEventListener("secureAjax", function (e) {
    schoologySecureAjax(JSON.parse(e.detail));
});