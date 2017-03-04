export default function getConfig($container, hideFn) {
    return {
        container: $container || document.body,
        placement: 'bottom',
        trigger: 'manual',
        // animation: 'fade',
        closeable: true,
        multi: false,
        dismissible: true,
        width: 400,

        onShow: $element => {

        },

        onHide: $element => {
            if(typeof hideFn === 'function') {
                hideFn();
            }
        }
    }

}
