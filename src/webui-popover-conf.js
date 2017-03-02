export default function getConfig($container) {
    return {
        container: $container || document.body,
        placement: 'bottom',
        trigger: 'manual',
        // animation: 'fade',
        closeable: false,
        multi: false,
        dismissible: true,
        width: 300,

        onShow: $element => {

        },

        onHide: $element => {

        }
    }

}
