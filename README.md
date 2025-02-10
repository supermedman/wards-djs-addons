
# Discord.js Menu Manager Addon

## This package comes with some useful development tools
 - List of helpful things here!
 - TODO


### Getting Started
```sh
npm install @th3ward3n/djs-menu
```

### Example `spawnCollector()`

```ts
    const exampleDisplay = {
        embeds: [
            new EmbedBuilder({
                title: "This is a simple User Choice Embed",
                description: "Confirm or Cancel?"
            })
        ],
        components: [spawnUserChoiceRow("Example Text")]
    };

    // Example option object, specifying expire timer and collectors to return
    const exampleOptions: ComponentCollectorOptionBase = {
        timeLimit: 180_000,
        sendAs: "Reply",
        collectors: {
            type: "Button",
        }
    };

    // Collector Spawning Response object
    /**
     * @example Using Destructing
     * ```ts
     * const { anchorMsg, buttons, strings } = await spawnCollector(i, exampleDisplay, exampleOptions);
     * ```
     */
    const packedResponse = await spawnCollector(interaction, exampleDisplay, exampleOptions);

    // Event Fires for any button interactions that pass filtering
    // Custom Filters can be passed to the spawner using `collectors: { filterWith: () => boolean }`
    packedResponse.buttons.on('collect', (collected) => {
        collected.deferUpdate().then(async () => {

            await collected.followUp({
                content: `Button Collected with customId: ${collected.customId}`,
                flags: MessageFlags.Ephemeral
            });

        }).catch(console.error);
    });

    // Event fires on the collector ending, if given a reason through `buttons.stop("reason")` it will fill the `reason` argument on "end"
    // If the collector ends due to the given timeLimit (default 60_000ms or 60 seconds) the "end" event will fire with `reason: "time"`
    packedResponse.buttons.on('end', (collected, reason) => {
        if (!reason || reason === 'time') handleCatchDelete(packedResponse.anchorMsg);
        console.log('Collected Components: ', collected);
        console.log('Ended with reason: ', reason);
    });
```

### Example `NumberBlockManager()`
```ts
    // Example user object, demonstrating limiters
    const user = { id: "123456789", coins: 500 };

    const selectedTotalEmbed = new EmbedBuilder({
        title: "Select an Amount",
        description: `Amount Selected: 0`
    });

    const amountBlock = new NumberBlockManager();

    const exampleDisplay = {
        embeds: [selectedTotalEmbed],
        components: amountBlock.rows
    };

    const {
        anchorMsg, 
        buttons
    } = await spawnCollector(interaction, exampleDisplay, options);

    buttons.on("collect", async (c) => {
        // Evaluate the collected id
        amountBlock.evaluate(c.customId);
        
        // This could be any possible condition of your own design!!!
        if (amountBlock.total > user.coins) {
            amountBlock.total = user.coins;
            // Provide feedback for why selected total stops at `500` given example
            await c.reply({
                content: `You cannot increase x more, as it would exceed your total coins ${user.coins}`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Example usage, updating an embed display with value total stored
        selectedTotalEmbed.setDescription(`Amount Selected: ${amountBlock.total}`);

        // For this example, editing the message using the initial display object
        // This will update the embed message, displaying the changes made to the existing description.
        await anchorMsg.edit(exampleDisplay);
    });

    buttons.on('end', (_, r) => {
        if (!reason || reason === 'time') handleCatchDelete(anchorMsg);
    });
```

### Example `Paginator()`

```ts
    const examplePageData: PagerDataOptionBase = {
        embeds: Array(25)
            .fill(0).map<EmbedBuilder>((_, idx) =>
                new EmbedBuilder({
                    title: `Page #${idx + 1}`,
                    description: "This is a page, it is one of many"
                }),
            ),
    };

    // Example option object, specifying expire timer and collectors to return
    const exampleOptions: ComponentCollectorOptionBase = {
        timeLimit: 180_000,
        sendAs: "Reply",
        collectors: {
            type: "Button",
        }
    };

    const pager = new Paginator(examplePageData);

    const {
        anchorMsg,
        buttons,
    } = await spawnCollector(i, pager.page, exampleOptions);


    buttons.on('collect', (collected) => {
        collected.deferUpdate().then(async () => {

            await anchorMsg.edit(pager.changePage(
                collected.customId.split('-')[0]
            ));

            await collected.followUp({
                content: `Button Collected with customId: ${collected.customId}`,
                flags: MessageFlags.Ephemeral
            });

        }).catch(console.error);
    });

    buttons.on('end', (_, reason) => {
        if (!reason || reason === 'time') handleCatchDelete(anchorMsg);
    });
```

### Example `MenuManager()` And why its so useful!

```ts
    const sharedBackRow = spawnBackButtonRow();

    const frameSize = 25;

    const exampleFrameData: MenuDataContentBase[] = Array(frameSize).fill(0)
        .map<MenuDataContentBase>(
            (_, idx) => ({
                embeds: [
                    new EmbedBuilder({
                        title: `Frame #${idx + 1}`,
                        description: "This is a frame in a menu, it is one of many!"
                    }),
                ],
                components: (idx === frameSize - 1) ? [sharedBackRow] : [
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder({
                                custom_id: `frame-${idx}-main`,
                                style: ButtonStyle.Primary,
                                label: "Do something!"
                            }),
                            new ButtonBuilder({
                                custom_id: `frame-${idx}-alt`,
                                style: ButtonStyle.Secondary,
                                label: "Do Something else!"
                            })
                        ).toJSON(),
                    sharedBackRow
                ],
            }),
        );
    const exampleMenuOptions: MenuManagerOptionBase = {
        contents: exampleFrameData[0],
        sendAs: "Reply",
        timeLimit: 300_000
    };

    const menu = await MenuManager.createAnchor(interaction, exampleMenuOptions);

    menu.buttons.on('collect', (c) => {
        c.deferUpdate().then(async () => {

            switch (menu.analyzeAction(c.customId)) {
                case "PAGE":
                    // Not in use for this example!
                    break;
                case "NEXT":
                    // Move forward one context frame
                    await menu.frameForward(exampleFrameData[menu.position]);
                    break;
                case "BACK":
                case "CANCEL":
                    // Move backwards one context frame
                    await menu.frameBackward();
                    break;
                case "UNKNOWN":
                    // Unknown action, refresh current frame!
                    await menu.frameRefresh();
                    break;
            }

            await c.followUp({
                content: `Collected Button: ${c.customId}`,
                flags: MessageFlags.Ephemeral
            });

        }).catch(console.error);
    });

    menu.buttons.on('end', (_, r) => {
        if (!r || r === 'time') return menu.destroy();
    });
```

### Slightly Advanced `MenuManager` Usage
```ts
    const sharedBackRow = spawnBackButtonRow();

    /**
     * Main Menu (Frame 0 / Initial Message)
     */
    const exampleMainMenuDisplay = new EmbedBuilder({
        title: "== Select a Help Catagory ==",
        description: "> `Fun`\n> `Utility`\n> `Other`"
    });
    const exampleMainMenuControls = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: "fun",
            style: ButtonStyle.Secondary,
            label: "Fun Commands"
        }),
        new ButtonBuilder({
            custom_id: "utility",
            style: ButtonStyle.Secondary,
            label: "Utility Commands"
        }),
        new ButtonBuilder({
            custom_id: "other",
            style: ButtonStyle.Secondary,
            label: "Other Commands"
        }),
    ).toJSON();


    /**
     * Injected Placeholder Frame
     * 
     * This method of using placeholders is not desired, it is however currently required.
     * Work is being done to solve this concept in the base @th3ward3n/djs-menu package
     */
    const exampleEmptyDisplay = new EmbedBuilder({
        title: "== This will never be seen =="
    });

    /**
     * Sub Menus (Frame 1 / Injected Per Selected Catagory)
     */
    const exampleCommandNames = {
        fun: ["cute-animal", "meme", "urban-dictonary"],
        utility: ["command-use-stats", "help", "profile"],
        other: ["ping", "info"]
    };

    const loadHelpCommandPages = (names: string[]) => {
        return {
            embeds: Array(names.length).fill(0).map<EmbedBuilder>(
                (_, idx) =>
                    new EmbedBuilder({
                        title: `= How to use ${names[idx]} =`,
                        description: "This is an example help page for a command!"
                    }),
            ),
        };
    };

    const exampleFunCommandPages = loadHelpCommandPages(exampleCommandNames.fun);
    const exampleUtilityCommandPages = loadHelpCommandPages(exampleCommandNames.utility);
    const exampleOtherCommandPages = loadHelpCommandPages(exampleCommandNames.other);

    // Staticly Developer Defined Frame Structure
    // This is where you can store and manipulate menu "paths" to suit your specific needs
    // In this example, each "path" follows the same structure, therefore no advanced pathways are used
    const exampleFrameData: MenuDataContentBase[] = [
        {
            embeds: [exampleMainMenuDisplay],
            components: [exampleMainMenuControls]
        },
        {
            embeds: [exampleEmptyDisplay],
            components: [sharedBackRow]
        }
    ];

    const exampleMenuOptions: MenuManagerOptionBase = {
        contents: exampleFrameData[0],
        sendAs: "Reply",
        timeLimit: 300_000
    };

    const menu = await MenuManager.createAnchor(interaction, exampleMenuOptions);

    // Attach internal Paginators using unique ids
    /**
     * @note Given `id`s should be able to exactly match a button/stringSelect `custom_id`
     * @example
     * ```ts
     * menu.spawnPageContainer(pageData, "uniqueid");
     * 
     * // INCORRECT 
     * const WRONG_ExampleButton = new ButtonBuilder()
     *      .setCustomId("action-something-uniqueid");
     * const WRONG_ExampleButtonTwo = new ButtonBuilder()
     *      .setCustomId("action-uniqueid-something");
     * 
     * // CORRECT!!
     * const CORRECT_ExampleButton = new ButtonBuilder()
     *      .setCustomId("uniqueid-action-something");
     * ```
     * 
     * Refer to `exampleMainMenuControls` for `custom_id` associations
     */
    menu.spawnPageContainer(exampleFunCommandPages, "fun");
    menu.spawnPageContainer(exampleUtilityCommandPages, "utility");
    menu.spawnPageContainer(exampleOtherCommandPages, "other");

    // Note - Paginator data is persistant, each Paginator will maintain `currentPage` throughout a `MenuManager`s lifetime

    menu.buttons?.on('collect', (c) => {
        c.deferUpdate().then(async () => {

            switch (menu.analyzeAction(c.customId)) {
                case "PAGE":
                    // Handle paging internally
                    await menu.framePageChange(c.customId);
                    break;
                case "NEXT":
                    // In this example, any button pressed on the first frame will require a paginator injection
                    // Here we are loading the placeholder frame embeds, and specifing the paging `id` to inject with
                    // Refer to the example shown above the paginator attachment step.
                    if (menu.position === 1) {
                        await menu.frameForward(
                            exampleFrameData[menu.position],
                            { usePager: c.customId.split('-')[0] }
                        );
                    }
                    break;
                case "BACK":
                case "CANCEL":
                    await menu.frameBackward();
                    break;
                case "UNKNOWN":
                    await menu.frameRefresh();
                    break;
            }

            await c.followUp({
                content: `Collected Button: ${c.customId}`,
                flags: MessageFlags.Ephemeral
            });

        }).catch(console.error);
    });

    menu.buttons?.on('end', (_, r) => {
        if (!r || r === 'time') menu.destroy();
    });
```