/**
 * OneSignal Service - STUB
 * OneSignal has been removed from this project.
 * This stub file exists to prevent import errors from components that still reference it.
 * All methods are no-ops that return safe defaults.
 */

class OneSignalService {
    async init() { }
    async isSubscribed(): Promise<boolean> { return false; }
    async requestPermission(): Promise<boolean> { return false; }
    async subscribeToMatch(_matchId: string): Promise<void> { }
    async unsubscribeFromMatch(_matchId: string): Promise<void> { }
    async subscribeToTournament(_tournamentId: string, _adminId?: string): Promise<void> { }
    async unsubscribeFromTournament(_tournamentId: string, _adminId?: string): Promise<void> { }
    async sendToMatch(
        _matchId: string,
        _adminId: string,
        _title: string,
        _message: string,
        _url?: string,
        _icon?: string,
        _buttons?: any[],
        _collapseId?: string,
        _tournamentTag?: string
    ): Promise<boolean> { return false; }
    async getPlayerId(): Promise<string | null> { return null; }
}

export const oneSignalService = new OneSignalService();
