export default function getConfig($container, hideFn, closeBtn = true) {
    return {
        container: $container || document.body,
        placement: 'bottom',
        trigger: 'manual',
        // animation: 'fade',
        closeable: closeBtn,
        multi: false,
        dismissible: true,
        width: 460,
        cache: false,  //re-create popover each time

        onShow: $element => {

        },

        onHide: $element => {
            if (typeof hideFn === 'function') {
                hideFn();
            }
        }
    }

}
