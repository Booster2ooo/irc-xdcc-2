export declare class XdccMessage {
    /**
     * @property {string} sender ctcp message emitter (= server bot nick aka botNick)
     */
    sender: string | undefined;
    /**
     * @property {string} sender ctcp message recipient (= IRC client nick)
     */
    target: string | undefined;
    /**
     * @property {string} message ctcp message
     */
    message: string | undefined;
    /**
     * @property {string[]} params parsed ctcp message
     */
    params: string[];
}
//# sourceMappingURL=irc-xdcc-message.d.ts.map