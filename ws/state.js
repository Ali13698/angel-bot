// State مشترک WebSocket
// clients: Map(ws → { userId, code, gameId })
// onlineUsers: Map(userId → ws)
// pendingInvites: Map(inviteId → { from, to, createdAt })

export const clients = new Map();
export const onlineUsers = new Map();
export const pendingInvites = new Map();
