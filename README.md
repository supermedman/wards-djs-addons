
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

### Example `new Paginator()`

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