import { spawnBasePagingRow } from "./components.js";
import { APIActionRowComponent, APIButtonComponent, APIMessageActionRowComponent, BaseMessageOptions, ButtonStyle } from "discord.js";


export type PagerDataOptionBase = Omit<BaseMessageOptions,
    'content'
    | 'allowedMentions'
    | 'components'
> & { components?: APIActionRowComponent<APIMessageActionRowComponent>[][] };
type PagerComponentBase = Pick<PagerDataOptionBase, 'components'>;
type PagerComponentRow = { components?: APIActionRowComponent<APIMessageActionRowComponent>[] };
type PagerContentBase = Omit<PagerDataOptionBase, 'components'>;
type PagerControlRow = APIActionRowComponent<APIButtonComponent>;


export class Paginator {
    /**
     * Current Paginator Index value
     */
    public currentPage: number = 0;
    /**
     * Length of Paging contents, used for wraparound
     */
    public finalPage: number = 0;
    /**
     * Valid BaseMessageOptions content base: `embeds | files | both`  
     */
    private activePage: PagerContentBase = {};
    /**
     * Valid BaseMessageOptions component base: `components`
     */
    private activeRows: PagerComponentRow = {};
    /**
     * Internal Page object containing `embeds[] | files[] | both`
     */
    private indexedContent: PagerContentBase = {};
    /**
     * Internal Page object containing `components[]` if given 
     */
    private indexedRows: PagerComponentBase = {};
    /**
     * Special Control Row used for `custom_id` specific actions using reserved `ids`
     */
    private controlRow: PagerControlRow;

    constructor(pagingData: PagerDataOptionBase, controllerRow: PagerControlRow = spawnBasePagingRow()) {
        this.controlRow = controllerRow;
        this.loadPages(pagingData);
        this._updateActivePage();
    }

    /**
     * This method can be used to externally reload the Paginators internal contents, however it is unlikely to need this.
     * 
     * @param data Full paging context content object to overwrite any currently stored content
     */
    public loadPages(data: PagerDataOptionBase) {
        this.currentPage = 0;

        let validateCondition = 0;

        if ('embeds' in data) {
            this.indexedContent['embeds'] = data.embeds;
            validateCondition = 1;
        }
        if ('files' in data) {
            this.indexedContent['files'] = data.files;
            validateCondition += 2;
        }
        if ('components' in data) {
            this.indexedRows['components'] = data.components;
            validateCondition += 3;
        }

        switch (validateCondition) {
            case 1:
                // Only embeds
                this.finalPage = this.indexedContent['embeds']!.length;
                break;
            case 2:
                // Only files
                this.finalPage = this.indexedContent['files']!.length;
                break;
            case 3:
                // Check if '!embeds' error on `Only Components`
                if ('embeds' in data === false) throw new Error('Failed to load Paginator: One of `embeds` or `files` must be present when constructing a new Paginator!');
                if (
                    this.indexedContent['embeds']!.length
                    !== this.indexedContent['files']!.length
                ) throw new Error('Failed to load Paginator: Mismatched data lengths, `embeds` and `files` must be the same length!');
                this.finalPage = this.indexedContent['embeds']!.length;
                break;
            case 4:
                // Check embeds/components
                if (
                    this.indexedContent['embeds']!.length
                    !== this.indexedRows['components']!.length
                ) throw new Error('Failed to load Paginator: Mismatched data lengths, `embeds` and `components` must be the same length!');
                this.finalPage = this.indexedContent['embeds']!.length;
                break;
            case 5:
                // Check files/components
                if (
                    this.indexedContent['files']!.length
                    !== this.indexedRows['components']!.length
                ) throw new Error('Failed to load Paginator: Mismatched data lengths, `files` and `components` must be the same length!');
                this.finalPage = this.indexedContent['files']!.length;
                break;
            case 6:
                // Check all three
                if (
                    (
                        this.indexedContent['embeds']!.length
                        !== this.indexedRows['components']!.length
                    ) ||
                    (
                        this.indexedContent['files']!.length
                        !== this.indexedRows['components']!.length
                    )
                ) throw new Error('Failed to load Paginator: Mismatched data lengths, `embeds`, `files`, and `components` must be the same length!');
                this.finalPage = this.indexedContent['embeds']!.length;
                break;
        }
    }

    /**
     * This method should be used as the main entry point for all Paging updates, 
     * the given example shows the process required to handle paging in the case a MenuManager is not in use
     * 
     * @example
     * ```js
     * 
     * const pageData = { 
     *      embeds: [
     *          new EmbedBuilder({ title: "Example"}),
     *          new EmbedBuilder({ title: "Example 2"})
     *      ]
     * };
     * 
     * const pager = new Paginator(pageData);
     * 
     * const { anchorMsg, buttons: collector } = await spawnCollector(interaction, pager.page);
     * 
     * collector.on('collect', async (collected) => {
     *      // This would be either "next" or "back" given the example
     *      await anchorMsg.edit(pager.changePage(collected.customId.split('-')[0])); 
     * });
     * ```
     * 
     * @param direction One of `"next" | "back"` see example for simple extraction methods from `custom_id`
     * @returns Updated context as a valid BaseMessageOption instance type
     */
    public changePage(direction: "next" | "back" | string) {
        if (!["next", "back"].includes(direction)) throw new Error('Failed to change Paginator Page: Invalid paging direction given!', { cause: direction });

        switch (direction) {
            case "next":
                this.currentPage = (this.currentPage === this.finalPage)
                    ? 0
                    : this.currentPage + 1;
                break;
            case "back":
                this.currentPage = (this.currentPage === 0)
                    ? this.finalPage
                    : this.currentPage - 1;
                break;
        }

        return this.page;
    }

    private _updateActivePage() {
        if (this.indexedContent['embeds'])
            this.activePage['embeds'] = [this.indexedContent['embeds'][this.currentPage]];
        if (this.indexedContent['files'])
            this.activePage['files'] = [this.indexedContent['files'][this.currentPage]];
        if (this.indexedRows['components'])
            this.activeRows['components'] = [this.controlRow, ...this.indexedRows['components'][this.currentPage]];

        return this.activePage;
    }

    /**
     * Updates the activePage and compiles all needed components through a side-effect
     * 
     * The returned object is some form of the `BaseMessageOptions` type based on the content loaded into this Paginator
     */
    get page() {
        return { ...this._updateActivePage(), components: this.activeRows['components']! };
    }

    /**
     * This gets the stored `controlRow` ActionRow component
     */
    get baseRow() {
        return this.controlRow;
    }

    /**
     * This gets the stored `controlRow` returning all `custom_id` strings found.
     */
    get baseRowIds() {
        const isButtonWithId = (c: APIButtonComponent) => c.style !== ButtonStyle.Premium && c.style !== ButtonStyle.Link;
        return this.controlRow['components'].filter(c => isButtonWithId(c))
            .filter(b => !b.custom_id.startsWith('cancel'))
            .map(b => b.custom_id);
    }
}