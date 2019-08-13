/**
 * Class representing an XDCC message.
 */
export declare class XdccMessage {
    /**
     * @property {string} sender The CTCP message emitter (= server bot nick aka botNick)
     */
    sender: string | undefined;
    /**
     * @property {string} sender The CTCP message recipient (= IRC client nick)
     */
    target: string | undefined;
    /**
     * @property {string} message The CTCP message
     */
    message: string | undefined;
    /**
     * @property {string[]} params The parsed CTCP message
     */
    params: string[];
}
//# sourceMappingURL=irc-xdcc-message.d.ts.map