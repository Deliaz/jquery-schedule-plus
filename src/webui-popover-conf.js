export default function getConfig($container) {
    return {
        container: $container || document.body,
        placement: 'bottom',
        trigger: 'manual',
        // animation: 'fade',
        closeable: true,
        multi: false,
        dismissible: true,
        width: 300,

        onShow: $element => {

        },

        onHide: $element => {

        }
    }

}
