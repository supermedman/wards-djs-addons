import { BaseMessageOptions, CommandInteraction, Message } from "discord.js";

export interface MessageCreationOptionBase {
    timeLimit?: number;
    sendAs?: "Reply" | "FollowUp";
}

/**
 * This function handles sending/returning a sent Message object for further usage
 * 
 * @param interaction Active Interaction Object
 * @param contents Message Content to be sent
 * @param options Options object for send method 
 * @returns Fetched Message Object after being sent
 */
export async function sendMessage(
    interaction: CommandInteraction,
    contents: BaseMessageOptions,
    options?: MessageCreationOptionBase
): Promise<Message> {
    if (!options || !options.sendAs) {
        const c = interaction.client.channels.cache.get(interaction.channelId);
        if (!c || !c.isSendable()) throw new Error('Failed to send a message: ', { cause: `Channel with id ${(c) ? c['id'] : '0'} is not sendable` });
        return await c.send(contents);
    }

    let response: Message<boolean>;
    switch (options.sendAs) {
        case "Reply":
            // response = await interaction.reply({ ...contents, fetchReply: true });
            // @<v14.17.0
            await interaction.reply({ ...contents, withResponse: true });
            response = await interaction.fetchReply();
            break;
        case "FollowUp":
            response = await interaction.followUp(contents);
            break;
    }
    return response;
}

/**
 * This function handles catching a message sent using `sendMessage` assinging it to self destruct after the given,
 * `options.timeLimit` has passed or after `60 seconds` if no time limit is given
 * 
 * @param interaction Active Interaction Object
 * @param contents Message Content to be sent
 * @param options Options object for send method and timelimit
 */
export async function sendTimedChannelMessage(
    interaction: CommandInteraction,
    contents: BaseMessageOptions,
    options?: MessageCreationOptionBase
): Promise<void> {
    sendMessage(interaction, contents, options).then((anchorMsg) =>
        setTimeout(
            () => handleCatchDelete(anchorMsg),
            (options && options.timeLimit) ? options.timeLimit : 60_000
        )
    );
}

/**
 * This function handles deleting the given `anchorMsg` while ignoring the `Missing Message` error,
 * this is done as any error related to a message not existing implies it is already deleted!
 * 
 * @param anchorMsg Message object being deleted
 */
export function handleCatchDelete(anchorMsg: Message): void {
    anchorMsg.delete().catch((e) => {
        if (e.code !== 10008) throw new Error('Faile to delete a message: ', e);
    });
}