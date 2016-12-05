import SELECTORS from './selectors';

const webuiPopoverHTML = require('./templates/webui-popover.html');

export default function getConfig($container) {
    return {
        container: $container || document.body,
        content: webuiPopoverHTML,
        placement: 'bottom',
        trigger: 'manual',
        animation: 'fade',
        closeable: true,
        multi: false,
        dismissible: true,
        width: 300,

        onShow: $element => {

        },

        onHide: $element => {
            $element.find(SELECTORS.eventTitleInput).val('');
        }
    }

}
