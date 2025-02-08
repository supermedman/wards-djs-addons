import { ComponentCollectorOptionBase, spawnBasePagingRow, spawnCollector } from "./components.js";
import { handleCatchDelete } from "../utils/message.js";
import { APIActionRowComponent, APIMessageActionRowComponent, BaseMessageOptions, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, InteractionCollector, Message, StringSelectMenuInteraction } from "discord.js";
import { Paginator, PagerDataOptionBase } from "./paginator.js";

export type MenuDataContentBase = Omit<BaseMessageOptions,
    'content'
    | 'allowedMentions'
    | 'components'
> & { components: APIActionRowComponent<APIMessageActionRowComponent>[] };

export interface MenuManagerOptionBase extends ComponentCollectorOptionBase {
    contents: MenuDataContentBase
}

type AnchorResponse = {
    anchorMsg: Message;
    buttons: InteractionCollector<ButtonInteraction>;
    strings: InteractionCollector<StringSelectMenuInteraction> | undefined;
};

interface ActiveMenuContext {
    display?: MenuDataContentBase;
    pager?: string;
}

export interface FrameForwardOptions {
    usePager?: string | boolean;
}

export class MenuManager {
    /**
     * Main Message Context Reference, Initilized on instance creation
     */
    public anchorMsg: Message | undefined;

    /**
     * Buttons Component Collector, attached to `this.anchorMsg` 
     */
    public buttons: InteractionCollector<ButtonInteraction> | undefined;

    /**
     * StringSelect Component Collector, attached to `this.anchorMsg`
     * 
     * Instance Options must specify to include this collector, otherwise this will be undefined
     */
    public strings: InteractionCollector<StringSelectMenuInteraction> | undefined;

    /**
     * Context Container for the currently displayed Frame.
     * 
     * Will contain any injection flags such as an active `Paginator`
     */
    private activeContext: { [frame: string]: ActiveMenuContext } = {};

    /**
     * Array of `Frames` maintaining reference to past `Frames` in order of appearence
     */
    private displayFrames: MenuDataContentBase[] = [];

    /**
     * Active Paginator page last displayed, used for injection into the `activeContext`
     */
    private activeFramePage: MenuDataContentBase | undefined;

    /**
     * Pagination storage: `"id": Paginator`
     */
    private pagers: { [id: string]: Paginator } = {};

    /**
     * Reserved Override `custom_id` list, used to inject display updates through an active context if not the base display
     */
    private pagingActions: string[] = ['back-page', 'next-page'];

    /**
     * Reserved Override `custom_id` list, used to ignore specific ids should it be needed
     */
    private ignoreActions: string[] = [];

    /**
     * Indexed to mirror `displayFrames` positions, each array contains `custom_id` strings that should trigger a `"NEXT"` action
     */
    private nextFrameActions: string[][] = [];
    /**
     * Indexed to mirror `displayFrames` positions, each array contains `custom_id` strings that should trigger a `"BACK"` action
     */
    private backFrameActions: string[][] = [];
    /**
     * Indexed to mirror `displayFrames` positions, each array contains `custom_id` strings that should trigger a `"CANCEL"` action
     */
    private cancelFrameActions: string[][] = [];

    /**
     * Component ID Extraction Conditions
     */
    private readonly checkIf = {
        isPagination: (id: string) => this.pagingActions.includes(id),
        isIgnored: (id: string) => this.ignoreActions.includes(id),
        // IS reserved
        isReserved: (id: string) => {
            return this.checkIf.isPagination(id) || this.checkIf.isIgnored(id);
        },
        // NOT reserved AND IS back action
        isBackAction: (id: string) => {
            return !this.checkIf.isReserved(id) && id.startsWith('back-');
        },
        // NOT reserved AND IS cancel action
        isCancelAction: (id: string) => {
            return !this.checkIf.isReserved(id) && id.startsWith('cancel');
        },
        // NOT cancel action, NOT back action AND NOT reserved
        isForwardAction: (id: string) => {
            return !this.checkIf.isBackAction(id) && !this.checkIf.isCancelAction(id) && !this.checkIf.isReserved(id);
        },
        isButton: (c: APIMessageActionRowComponent) => c.type === ComponentType.Button && c.style !== ButtonStyle.Premium && c.style !== ButtonStyle.Link,
        isStrSelect: (c: APIMessageActionRowComponent) => c.type === ComponentType.StringSelect
    };

    /**
     * ID Input Control type filters
     */
    private readonly checkFor = {
        isPagingAction: (id: string) => this.pagingActions.includes(id),
        isForwardAction: (id: string) => this.nextFrameActions.at(-1)?.includes(id),
        isBackwardAction: (id: string) => this.backFrameActions.at(-1)?.includes(id),
        isCancelAction: (id: string) => this.cancelFrameActions.at(-1)?.includes(id),
    };

    /**
     * Active Context Condition Checks
     */
    private readonly checkCondition = {
        hasPagers: () => !!Object.keys(this.pagers).length,
        hasPager: (id: string) => !!this.pagers[id],
        hasContextPager: () => typeof this.activeContext[`${this.position - 1}`].pager === 'string'
    };

    /**
     * This is the main entry point for making a new MenuManager. 
     * 
     * 
     * 
     * @example
     * ```js
     * const menu = await MenuManager.createAnchor(interaction, options);
     * ```
     * 
     * @param interaction Command interaction to use as internal context
     * @param options All init options to use, passed to the collectors and used for initial frame display
     * @returns new MenuManager instance
     */
    static async createAnchor(interaction: ChatInputCommandInteraction, options: MenuManagerOptionBase) {
        const res: AnchorResponse = await spawnCollector(interaction, options.contents, options);
        return new MenuManager(options, res);
    }

    /**
     * @note ## Do not attempt to create a MenuManager instance with `new MenuManager()`
     * VVVVVVVV
     * @example 
     * ```js
     * // INCORRECT - This method while possible, may change going forward and should not be used!
     * const anchorResponse = await spawnCollector(interaction, contents, options);
     * const menu = new MenuManager(options, anchorResponse);
     * 
     * // CORRECT
     * const menu = await MenuManager.createAnchor(interaction, options);
     * ```
     */
    private constructor(options: MenuManagerOptionBase, anchorOutcome: AnchorResponse) {
        this._proccessActionList(options.contents.components);

        this.anchorMsg = anchorOutcome.anchorMsg;
        if (this.anchorMsg) this.anchorMsg!;
        this.buttons = anchorOutcome.buttons;
        if (this.buttons) this.buttons!;
        this.strings = anchorOutcome.strings;
        if (this.strings) this.strings!;

        this.displayFrames.push(options.contents);

        this.activeContext[`${this.position - 1}`] = {
            display: options.contents
        };
    }

    /**
     * Retrieve the "newest" display frame stored in `this.displayFrames` if no content is found returns "error content"
     */
    get frame() {
        return this.displayFrames.at(-1) ?? { content: "Message edit failure: No Display Found" };
    }

    /**
     * Retrieves the "current" page display, if contents are invalid will return content string, concats frame components with page components.
     * 
     * Concat may fail, this will happen if the total ActionRow length exceeds 5, keep this in mind when designing the menu frames!
     */
    get framePage() {
        if (
            !this.activeFramePage ||
            !this.activeFramePage.components
        ) return { content: "No paging display found!" };
        if (
            !this.displayFrames.length ||
            !this.displayFrames.at(-1)?.components
        ) throw new Error("No active display exists, failed to display frame page data");

        this.activeFramePage.components = this.activeFramePage.components.concat(
            this.displayFrames.at(-1)?.components ?? []
        );

        return this.activeFramePage;
    }

    /**
     * Get the current displayed frames length.
     */
    get position() {
        return this.displayFrames.length;
    }

    /**
     * This method handles determining the `Menu Frame Action` to take, given the `id` 
     * 
     * @example
     * ```js
     * const menu = await MenuManager.createAnchor(interaction, options);
     * 
     * menu.buttons.on('collect', async (collected) => {
     *      switch (menu.analyzeAction(collected.customId)) {
     *          case "PAGE":
     *              break;
     *          case "NEXT":
     *              break;
     *          case "BACK":
     *              break;
     *          case "CANCEL":
     *              break;
     *      }
     * })
     * ```
     * 
     * @param id Full `.customId` of collected component
     * @returns Action to take based on id given
     */
    public analyzeAction(id: string) {
        // Check page first as it implements display injection, and should not change the active frame
        if (this.checkFor.isPagingAction(id)) {
            return 'PAGE';
        } else if (this.checkFor.isForwardAction(id)) {
            return 'NEXT';
        } else if (this.checkFor.isBackwardAction(id)) {
            return 'BACK';
        } else if (this.checkFor.isCancelAction(id)) {
            return 'CANCEL';
        } else return 'UNKNOWN';
    }

    /**
     * This method handles attaching a `new Paginator` instance to the current MenuManager, a basic pagingComponent row is created
     * using `id` as an extension for `back-page-${id}` and `next-page-${id}`. This is how the menu internally manages stored Paginators.
     * 
     * @param contents Full paging display content arrays
     * @param id Defaults to "0" specify this value if you plan to use more than one Paginator
     */
    public spawnPageContainer(contents: PagerDataOptionBase, id: string = "0") {
        if (this.pagers[id])
            throw new Error("Additional Paginators require unique ids!!");
        this.pagers[id] = new Paginator(contents, spawnBasePagingRow({ id }));
        if (!this.activeFramePage) this.activeFramePage = this.pagers[id].page;
    }

    /**
     * This method handles updating a Paginator stored with `id` using the builtin `Paginator.loadPages()` method 
     * 
     * @param contents Full paging display content arrays, will overwrite existing data stored
     * @param id Defaults to "0", specify this value if you are using more than one Paginator
     */
    public updatePageContainer(contents: PagerDataOptionBase, id: string = "0") {
        if (!this.pagers[id])
            throw new Error("No Paginator for for given id!");
        this.pagers[id].loadPages(contents);
    }

    /**
     * This method handles updating the current `activeFramePage` calling a frameRefresh with injection.
     * 
     * @example
     * ```js
     * const menu = await MenuManager.createAnchor(interaction, options);
     * 
     * menu.buttons.on('collect', async (collected) => {
     *      switch (menu.analyzeAction(collected.customId)) {
     *          case "PAGE":
     *              // This will update a pager stored, edit with injection the current display (anchorMsg will undergo a PATCH request)
     *              await menu.framePageChange(collected.customId);
     *              break;
     *          case "NEXT":
     *              break;
     *          case "BACK":
     *              break;
     *          case "CANCEL":
     *              break;
     *      }
     * })
     * ```
     * 
     * @param fullCustomId Untouched `custom_id` from collected component, if this id has been modified this method is likely to fail!
     */
    public async framePageChange(fullCustomId: string) {
        if (!this.checkCondition.hasPagers())
            throw new Error("No paginators have been created yet! Create one first using `MenuManager.spawnPageContainer`");
        const idSplits = fullCustomId.split('-');
        const pagerId = idSplits.at(-1) ?? '0';
        const pagerDirection = idSplits[0];

        this.activeFramePage = this.pagers[pagerId].changePage(pagerDirection);

        await this.frameRefresh(true);
    }

    /**
     * This method handles appending the given contents to the menus internal context storages. Analyzing ids, managing Paginators, and refreshing the current displayed page
     * 
     * @example
     * ```js
     * const menu = await MenuManager.createAnchor(interaction, options);
     * 
     * menu.buttons.on('collect', async (collected) => {
     *      switch (menu.analyzeAction(collected.customId)) {
     *          case "PAGE":
     *              break;
     *          case "NEXT":
     *              // This will update the internal display frame, appending given options to the activeContext
     *              await menu.frameForward(frameContents, frameOptions);
     *              break;
     *          case "BACK":
     *              break;
     *          case "CANCEL":
     *              break;
     *      }
     * })
     * ```
     * 
     * @param contents Frame content to append to display array
     * @param options Used to attach an injection context reference if needed
     * @returns After PATCH call has completed on `anchorMsg` with updated display
     */
    public async frameForward(contents: MenuDataContentBase, options?: FrameForwardOptions) {
        this.displayFrames.push(contents);
        if (!options) {
            this._proccessActionList(contents.components);
            this.activeContext[`${this.position - 1}`] = { display: contents };
            return await this.frameRefresh();
        }

        const contextBuilder: ActiveMenuContext = { display: contents };
        if (options.usePager) {
            if (
                !this.checkCondition.hasPagers() ||
                (
                    typeof options.usePager === 'string' &&
                    !this.checkCondition.hasPager(options.usePager)
                )
            ) throw new Error("A Paginator must exist before it can be assigned to a context!");

            contextBuilder.pager = (typeof options.usePager === 'string')
                ? options.usePager : '0';

            const contextPager = this.pagers[contextBuilder.pager];

            this._injectPagingContext(contextPager);

            this._proccessActionList(contents.components.concat(contextPager.baseRow));
        } else this._proccessActionList(contents.components);

        this.activeContext[`${this.position - 1}`] = contextBuilder;

        return await this.frameRefresh(typeof contextBuilder.pager === 'string');
    }

    /**
     * This method is mainly used internally, however it has been left exposed as a fallback to better account for external issues where a display could not be resolved
     * 
     * @example
     * ```js
     * const menu = await MenuManager.createAnchor(interaction, options);
     * 
     * menu.buttons.on('collect', async (collected) => {
     *      switch (menu.analyzeAction(collected.customId)) {
     *          case "PAGE":
     *              break;
     *          case "NEXT":
     *              break;
     *          case "BACK":
     *              break;
     *          case "CANCEL":
     *              break;
     *          default:
     *              // This is reload the current frame without making any new changes
     *              await menu.frameRefresh();
     *              break;
     *      }
     * })
     * ```
     * 
     * @param paging Whether to display using Injection from pages
     */
    public async frameRefresh(paging = false) {
        if (!this.anchorMsg)
            throw new Error('Message Reference Failure: AnchorMsg no longer exists!');
        await this.anchorMsg.edit((!paging) ? this.frame : this.framePage);
    }

    /**
     * This method handles shifting the current display array back one frame, it does this by `.pop`ing from each internal storage
     * 
     * @example
     * ```js
     * const menu = await MenuManager.createAnchor(interaction, options);
     * 
     * menu.buttons.on('collect', async (collected) => {
     *      switch (menu.analyzeAction(collected.customId)) {
     *          case "PAGE":
     *              break;
     *          case "NEXT":
     *              break;
     *          case "BACK":
     *              // Is best used to handle `Back` events 
     *              await menu.frameBackward();
     *              break;
     *          case "CANCEL":
     *              // Can also be used to handle `Cancel` events
     *              await menu.frameBackward();
     *              break;
     *          default:
     *              break;
     *      }
     * })
     * ```
     * 
     * @returns After PATCH call has completed on `anchorMsg` with updated display
     */
    public async frameBackward() {
        if (this.displayFrames.length === 1) return;

        this.displayFrames.pop();
        this.backFrameActions.pop();
        this.cancelFrameActions.pop();
        this.nextFrameActions.pop();

        if (this.checkCondition.hasContextPager()) {
            const contextPager = this.pagers[this.activeContext[`${this.position - 1}`].pager ?? '0'];
            this._injectPagingContext(contextPager);
            await this.frameRefresh(true);
        } else await this.frameRefresh();
    }

    /**
     * This method reverts the menu to the initial frame state, removing all existing frames and actions without clearing any Paginators or other Injectors
     */
    public async frameRestart() {
        this.displayFrames = [this.displayFrames[0]];
        this.backFrameActions = [this.backFrameActions[0]];
        this.cancelFrameActions = [this.cancelFrameActions[0]];
        this.nextFrameActions = [this.nextFrameActions[0]];

        if (this.checkCondition.hasContextPager()) {
            const contextPager = this.pagers[this.activeContext[`${this.position - 1}`].pager ?? '0'];
            this._injectPagingContext(contextPager);
            await this.frameRefresh(true);
        } else await this.frameRefresh();
    }

    /**
     * This method is used internally to manage injected contexts, overriding pageActions and updating the activeFramePage
     * 
     * @note ***This method should not be modified as it has planned additions that will break any external usage***
     * 
     * @param pager Active Context Paginator
     */
    private _injectPagingContext(pager: Paginator) {
        this.pagingActions = pager.baseRowIds;

        this.activeFramePage = pager.page;
    }

    /**
     * This method ***should not*** be used manually, it is setup to manage frame state/action lists based on valid component ids as given.
     * If you need to modify this, you should instead consider evaluating the way in which you are orginizing and structuring your frames
     * 
     * @param actionList Active Frame Action Rows
     */
    private _proccessActionList(actionList: APIActionRowComponent<APIMessageActionRowComponent>[]) {
        interface ActionCollector {
            next: string[];
            back: string[];
            cancel: string[];
        }

        const actions: ActionCollector = { next: [], back: [], cancel: [] };
        for (const actionRow of actionList) {
            if (this.checkIf.isStrSelect(actionRow.components[0])) {
                actions.next.push(actionRow.components[0].custom_id);
                continue;
            }

            const remainingActions = actionRow.components.filter(c => this.checkIf.isButton(c)).map(b => b.custom_id);

            actions.next.push(...remainingActions.filter(id => this.checkIf.isForwardAction(id)));
            actions.back.push(...remainingActions.filter(id => this.checkIf.isBackAction(id)));
            actions.cancel.push(...remainingActions.filter(id => this.checkIf.isCancelAction(id)));
        }

        this.nextFrameActions.push(actions.next);
        this.backFrameActions.push(actions.back);
        this.cancelFrameActions.push(actions.cancel);
    }

    /**
     * This method is important for ensuring collectors are desposed along with the anchoring message.
     * 
     * @example
     * ```js
     * menu.buttons.on('end', async (collected, endReason) => {
     *      if (!endReason || endReason === "time") return menu.destroy();
     * });
     * ```
     * 
     * @returns void
     */
    public destroy() {
        if (!this.anchorMsg) return;
        handleCatchDelete(this.anchorMsg);
        if (this.buttons) this.buttons.stop();
        if (this.strings) this.strings.stop();
    }
}