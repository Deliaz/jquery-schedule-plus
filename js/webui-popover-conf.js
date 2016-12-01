import SELECTORS from './selectors';

export default function getConfig($container) {
    return {
        container: $container || document.body,
        content: `
    
    <form class="js-event-edit-form">
    <input type="text" class="js-event-title-input" name="title" placeholder="Заголовок">
    
    <button class="js-event-save-button" type="submit">Сохранить</button>
    <button class="js-event-delete-button" type="button">Удалить</button>
    </form>

`,
        trigger: 'manual',
        animation: 'fade',
        closeable: true,
        multi: false,
        dismissible: true,

        onShow: $element => {

        },

        onHide: $element => {
          $element.find(SELECTORS.eventTitleInput).val('');
        }
    }

}
