import { ActionRowBuilder, APIActionRowComponent, APIButtonComponent, BaseMessageOptions, ButtonBuilder, ButtonStyle, CollectedMessageInteraction, ChatInputCommandInteraction, ComponentType, Message } from "discord.js";
import { MessageCreationOptionBase, sendMessage } from "../utils/message.js";


export interface ComponentCollectorOptionBase extends MessageCreationOptionBase {
    collectors?: {
        type?: "Button" | "String" | "Both";
        filterWith?: string | ((i: CollectedMessageInteraction) => boolean);
    };
}

/**
 * This function handles creating the requested `options.collectors.type` MessageComponentCollectors, attaching to the provided `anchorMsg`
 * Defaults to one `Button` collector.
 * 
 * @param interaction Base interaction currently active
 * @param anchorMsg Anchor created during collector spawning
 * @param options Additional configuring options
 * @returns All component collectors now attached to the given anchorMsg
 */
function createComponentCollector(
    interaction: ChatInputCommandInteraction,
    anchorMsg: Message,
    options?: ComponentCollectorOptionBase
) {
    /**
     * Replace with `Assert` logic
     */
    // const hasCollectorOptions = !!(
    //     options &&
    //     options.collectors
    // );

    const applyFilter = (
        options &&
        options.collectors &&
        typeof options.collectors.filterWith === 'string'
    ) ? options.collectors.filterWith : interaction.user.id;
    const filter = (
        options &&
        options.collectors &&
        (options.collectors.filterWith && typeof options.collectors.filterWith !== 'string')
    ) ? options.collectors.filterWith : (i: CollectedMessageInteraction) => i.user.id === applyFilter;

    const buttonCollector = anchorMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter,
        time: (options && options.timeLimit) ? options.timeLimit : 60_000
    });

    const stringCollector = (
        options &&
        options.collectors &&
        options.collectors.type &&
        ['String', 'Both'].includes(options.collectors.type)
    ) ? anchorMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter,
        time: (options && options.timeLimit) ? options.timeLimit : 60_000
    }) : undefined;

    return { b: buttonCollector, s: stringCollector };
}

/**
 * This function handles sending a response to the provided `interaction` then using the returned `message` creates (based on `options.collectors.type`) `messageComponentCollectors`.
 * 
 * @param interaction interaction attached to the current command context called from
 * @param contents Display object to be used as the contents of the `anchorMsg`
 * @param options Additional options object, standard options object with additional `collectors` args
 * @returns Destructable `{ anchorMsg: Message, buttons: ButtonCollector, strings: StringSelectCollector | undefined }`
 */
export async function spawnCollector(
    interaction: ChatInputCommandInteraction,
    contents: BaseMessageOptions,
    options?: ComponentCollectorOptionBase
) {
    const anchorMsg = await sendMessage(interaction, contents, options);
    const { b, s } = createComponentCollector(interaction, anchorMsg, options);
    return { anchorMsg, buttons: b, strings: s };
}

/**
 * This function generates an actionRowComponent with a single button, configured as a Back Button
 * 
 * Default: `custom_id: "back-basic"`
 * 
 * @param id customId Extension `back-${id}`
 * @returns APIActionRow containing back button
 */
export function spawnBackButtonRow(id = "basic"): APIActionRowComponent<APIButtonComponent> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `back-${id}`,
            style: ButtonStyle.Secondary,
            label: 'Go Back'
        })
    ).toJSON();
}

type ButtonConfigOptionBase = {
    style?: ButtonStyle;
    labelText?: string;
};

interface UserChoiceButtonOptions {
    confirm?: ButtonConfigOptionBase;
    cancel?: ButtonConfigOptionBase;
}

/**
 * This function generates a simple confirm/cancel actionRow, simplifing the process.
 * 
 * Default IDs: confirm `confirm-${id}`, cancel `cancel-${id}`
 * 
 * @param id customId Extension `baseid-${id}`
 * @param options Button Config Options to apply
 * @returns APIActionRow component containing confirm/cancel buttons
 */
export function spawnUserChoiceRow(id: string, options?: UserChoiceButtonOptions): APIActionRowComponent<APIButtonComponent> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `confirm-${id}`,
            style: options?.confirm?.style ?? ButtonStyle.Success,
            label: `Confirm ${options?.confirm?.labelText ?? ""}`
        }),
        new ButtonBuilder({
            custom_id: `cancel-${id}`,
            style: options?.cancel?.style ?? ButtonStyle.Danger,
            label: `Cancel ${options?.cancel?.labelText ?? ""}`
        })
    ).toJSON();
}

interface PagingRowOptions {
    useEmoji?: boolean;
    useCancel?: boolean;
    // TODO
    // useExtraButtons?: (ButtonBuilder | APIButtonComponent)[];
    id?: string;
}

/**
 * This function generates a basic Page Change ActionRow, it's primary purpose is to vastly simplify the Pagination manager
 * 
 * @param options Paging Row Config Options
 * @returns APIActionRow using special internally reserved `custom_id` values for Pagination
 */
export function spawnBasePagingRow(options?: PagingRowOptions): APIActionRowComponent<APIButtonComponent> {
    const idExtension = (options?.id) ? `-${options.id}` : "";

    const reservedBackButton = new ButtonBuilder({
        custom_id: `back-page${idExtension}`,
        style: ButtonStyle.Primary,
        label: "Backward"
    });
    if (options?.useEmoji) reservedBackButton.setEmoji('◀️');

    const reservedForwardButton = new ButtonBuilder({
        custom_id: `next-page${idExtension}`,
        style: ButtonStyle.Primary,
        label: "Forward"
    });
    if (options?.useEmoji) reservedForwardButton.setEmoji('▶️');

    if (!options || !options.useCancel) return new ActionRowBuilder<ButtonBuilder>().addComponents(
        reservedBackButton,
        reservedForwardButton
    ).toJSON();

    const buttonsToUse = [reservedBackButton];

    if (options.useCancel) {
        const basicCancelButton = new ButtonBuilder({
            custom_id: `cancel-page${idExtension}`,
            style: ButtonStyle.Secondary,
            label: "Cancel"
        });
        if (options.useEmoji) basicCancelButton.setEmoji('*️⃣');
    }

    // Extra Buttons added here

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...buttonsToUse,
        reservedForwardButton
    ).toJSON();
}

interface CallableSign {
    applySign(t: number, n: number): number;
}
class Subtract implements CallableSign {
    applySign(t: number, n: number): number {
        return t - n;
    }
}
class Multiply implements CallableSign {
    applySign(t: number, n: number): number {
        return t * n;
    }
}
class Addition implements CallableSign {
    applySign(t: number, n: number): number {
        return t + n;
    }
}

class SignCaller {
    callers: { [sign: string]: CallableSign } = {};
    constructor() {
        this.callers["minus"] = new Subtract();
        this.callers["mult"] = new Multiply();
        this.callers["plus"] = new Addition();
    }
}

export interface NumberBlockOptions {
    rows?: number;
    controlId?: string;
}

function spawnNumberBlockRows({
    rows = 3,
    controlId = "amount"
}: NumberBlockOptions = {}): APIActionRowComponent<APIButtonComponent>[] {
    // ==== ID ====
    const prefixes = ["minus", "minus", "mult", "plus", "plus"];
    const valuesTable = [
        ["10", "1", "10", "1", "10"],
        ["100", "25", "100", "25", "100"],
        ["10k", "1k", "1k", "1k", "10k"]
    ];
    const extension = controlId;

    // ==== STYLE ====
    const styles = [
        ButtonStyle.Primary,
        ButtonStyle.Primary,
        ButtonStyle.Secondary,
        ButtonStyle.Primary,
        ButtonStyle.Primary
    ];

    // ==== LABEL ====
    const convertIdToLabel = (id: string) => {
        const signMap: { [sign: string]: string } = {
            "minus": "-",
            "mult": "x",
            "plus": "+",
        };
        const idParts = id.split('-');
        return `${signMap[idParts[0]]}${idParts[1]}`;
    };

    // ==== INPUT BLOCK ROWS ====
    const numBlockActionRows: APIActionRowComponent<APIButtonComponent>[] = [];
    for (let row = 0; row < rows; row++) {
        const values = valuesTable[row];
        const rowButtons: ButtonBuilder[] = [];
        for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
            const fullId = [prefixes[rowIdx], values[rowIdx], extension].join('-');
            rowButtons.push(new ButtonBuilder({
                custom_id: fullId,
                style: styles[rowIdx],
                label: convertIdToLabel(fullId)
            }));
        }
        numBlockActionRows.push(
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(rowButtons)
                .toJSON(),
        );
    }

    // ==== CONTROL ROW ====
    const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `back-${extension}`,
            style: ButtonStyle.Secondary,
            label: "Go Back"
        }),
        new ButtonBuilder({
            custom_id: `confirm-${extension}`,
            style: ButtonStyle.Success,
            label: "Confirm Choice!"
        }),
        new ButtonBuilder({
            custom_id: `reset-${extension}`,
            style: ButtonStyle.Danger,
            label: "Reset selection (0)"
        }),
    ).toJSON();

    return numBlockActionRows.concat(controlRow);
}

export class NumberBlockManager {
    /**
     * Instance Storage of constructor args
     */
    private options: NumberBlockOptions;
    /**
     * Instance Storage of associated ActionRows 
     */
    private activeBlockRows: APIActionRowComponent<APIButtonComponent>[];
    /**
     * Contains all Button Component `custom_id`s linked to the NumberBlockManager Instance
     */
    private readonly activeBlockIds: string[] = [];
    /**
     * Active total, this is updated to represent the calculated outcome
     * of any evaluations handled by the Manager Instance 
     */
    private activeNumberTotal: number = 0;
    /**
     * Calculation Op Handler
     */
    private readonly callSigns = new SignCaller();
    /**
     * Useful dynamic user input for "amount" selections.
     * @example
     * ```ts
     *      const selectedTotalEmbed = new EmbedBuilder({
     *          title: "Select an Amount",
     *          description: `Amount Selected: 0`
     *      });
     * 
     *      const amountBlock = new NumberBlockManager();
     * 
     *      const exampleDisplay = {
     *          embeds: [selectedTotalEmbed],
     *          components: amountBlock.rows
     *      };
     * 
     *      const {
     *          anchorMsg, 
     *          buttons
     *      } = await spawnCollector(interaction, exampleDisplay, options);
     * 
     *      buttons.on("collect", async (c) => {
     *          
     *          amountBlock.evaluate(c.customId);
     * 
     *          await c.reply({
     *              content: `Id Selected: ${c.customId}\nTotal Updated: ${amountBlock.total}`,
     *              flags: MessageFlags.Ephemeral
     *          });
     *          
     *          selectedTotalEmbed.setDescription(`Amount Selected: ${amountBlock.total}`);
     * 
     *          await anchorMsg.edit(exampleDisplay);
     *      });
     * ```
     * 
     * @param options Specify `rows: > 3` to omit NumberBlock rows. Specify `controlId` if you intend on using multiple NumberBlocks at once
     */
    public constructor({ rows = 3, controlId = "amount" }: NumberBlockOptions = {}) {
        this.options = {
            rows,
            controlId
        };

        this.activeBlockRows = spawnNumberBlockRows(this.options);

        const isButtonWithId = (c: APIButtonComponent) => c.style !== ButtonStyle.Premium && c.style !== ButtonStyle.Link;

        this.activeBlockIds.push(
            ...this.rows.map(
                (row) =>
                    row.components
                        .filter(c => isButtonWithId(c))
                        .map<string>(c => c.custom_id)
            ).flat()
        );
    }

    /**
     * This method is all that is required to handle collected component actions, 
     * 
     * @param fullId Unaltered collected button component `custom_id`
     * @returns Updated total if given `fullId` matches NumberBlockManager.controlId, undefined otherwise
     */
    public evaluate(fullId: string) {
        // If given `fullId` is not included within full `custom_id` list ignore request
        if (!this.activeBlockIds.includes(fullId)) return;
        const splitId = fullId.split("-");
        // Check for matching controlId, if mismatching controlId assume this Manager should not evaluate, early return
        if (
            splitId[0] !== "reset" && splitId[2] !== this.options.controlId ||
            splitId[0] === "reset" && splitId[1] !== this.options.controlId
        ) return;

        // Evaluate with callSigns
        if (["minus", "mult", "plus"].includes(splitId[0])) {
            this._handleEvaluation(fullId);
        } else if (splitId[0] === "reset") {
            // Reset internal total
            this.activeNumberTotal = 0;
        }

        return this.total;
    }

    /**
     * This method only works if the stored NumberBlock ActionRow `custom_id`s are unmodified.
     * 
     * @note If you wish to make changes to this system, and/or the NumberBlock rows themselves, consider the following:
     * ### `custom_id`s are broken down into 3 parts: ***`${op}`***-***`${mag}`***-***`${association}`***
     * ### ***`${op}`*** must be "minus", "mult", or "plus"
     * - "minus": will preform a subtraction op
     * - "mult": will preform a multiplication op
     * - "plus": will preform an addition op
     * ### ***`${mag}`*** can be any "number" that will return `false` from `isNaN(Number(`**`${mag}`**`))`
     * - "k": is an exception, and can be used as a substitute for `000`, ***It is only valid when placed as the last character in the "number"***
     * - "k" Example: **VALID** `"100k"` **INVALID** `"10k0"` (<= This will return "10000" instead of "100000") 
     * ### ***`${association}`*** can be modified by providing `{ controlId: "association" }`. 
     * - This can be done from the base NumberBlockManager constructor
     * 
     * 
     * @note If you would like to add or change the available `${op}` list, your best choice would be to extend `SignCaller` itself.
     * ***This is not recommended***
     * 
     * @param fullId Unaltered collected button component `custom_id`
     */
    private _handleEvaluation(fullId: string) {
        const splitId = fullId.split("-");

        const applyConversion = (id: string): number => {
            return Number(
                (id.includes("k"))
                    ? id.slice(0, id.indexOf("k")) + "000"
                    : id
            );
        };

        const modifyWith = applyConversion(splitId[1]);
        this.activeNumberTotal = this.callSigns.callers[splitId[0]].applySign(
            this.activeNumberTotal,
            modifyWith
        );
    }

    /**
     * Returns full ActionRow component list
     */
    public get rows() {
        return this.activeBlockRows;
    }
    /**
     * Returns full ActionRow component list of relative `custom_id` strings
     */
    public get rowIds() {
        return this.activeBlockIds;
    }
    /**
     * Returns current total number value stored in `this`
     */
    public get total() {
        return this.activeNumberTotal;
    }
    /**
     * Exposed setter, useful for value total limits.
     * @example
     * ```ts
     *  const user = { id: "123456789", coins: 500 };
     * 
     *  const amountBlock = new NumberBlockManager();
     * 
     *  amountBlock.evaluate(collected.customId);
     * 
     *  if (amountBlock.total > user.coins) {
     *      amountBlock.total = user.coins;
     *      // Provide feedback for why selected total stops at `500` given example
     *      await collected.reply({
     *          content: `You cannot increase x more, as it would exceed your total coins ${user.coins}`,
     *          flags: MessageFlags.Ephemeral
     *      });
     *  }
     * 
     * ```
     * @note This functionality will possibly be integrated with the `NumberBlockManager` itself in the future!!
     */
    public set total(newTotal: number) {
        this.activeNumberTotal = newTotal;
    }
}