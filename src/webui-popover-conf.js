export default function getConfig($container, {
    hideFn,
    showFn,
    closeBtn = true
}) {
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
            if (typeof showFn === 'function') {
                showFn();
            }
        },

        onHide: $element => {
            if (typeof hideFn === 'function') {
                hideFn();
            }
        }
    }

}
