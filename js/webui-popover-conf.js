import SELECTORS from './selectors';

export default function getConfig($container) {
    return {
        container: $container || document.body,
        content: `
        
        <form class="event-edit-form js-event-edit-form">            
            <label for="event-title">Заголовок события</label>
            <input type="text" class="event-title-input js-event-title-input"
                id="event-title"
                name="title" 
                placeholder="Заголовок">
            
            <button class="event-save-button js-event-save-button" type="submit">Сохранить</button>
            <button class="event-delete-button js-event-delete-button" type="button">Удалить</button>
        </form>
`,
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
