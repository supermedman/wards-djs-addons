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

// TODO
// class NumberBlock {}