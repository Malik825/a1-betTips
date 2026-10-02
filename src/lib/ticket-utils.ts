export interface UserTicket {
  id: string;
  user_id: string;
  package_id: string;
  purchased_at: string;
  payment_ref?: string | null;
  booking_code?: string | null;
  snapshot?: any | null;
}

export interface VipPackage {
  id: string;
  name: string;
  price: number;
  availability_status: string;
  result_status: string;
  booking_code?: string | null;
  combined_odds?: number | null;
  expires_at?: string | null;
  updated_at?: string | null;
  is_published?: boolean;
}

/**
 * Determines whether a specific user ticket is valid for the current active package batch.
 *
 * If the package was updated/re-uploaded after the ticket was purchased,
 * or if the booking code doesn't match the one the user bought,
 * or if the package is expired, the ticket is considered completed/expired.
 */
export function isTicketValidForPackage(ticket: any, pkg: any): boolean {
  if (!ticket || !pkg) return false;
  if (ticket.package_id !== pkg.id) return false;

  // 1. If package availability status is explicitly marked as expired
  if (pkg.availability_status === "expired") {
    return false;
  }

  // 2. If the package has an expires_at timestamp that has passed
  if (pkg.expires_at) {
    const expiresTime = new Date(pkg.expires_at).getTime();
    if (!isNaN(expiresTime) && expiresTime < Date.now()) {
      return false;
    }
  }

  // 3. If package has updated_at, ticket must have been purchased on or after package was updated/posted
  if (pkg.updated_at && ticket.purchased_at) {
    const pkgUpdated = new Date(pkg.updated_at).getTime();
    const ticketPurchased = new Date(ticket.purchased_at).getTime();
    // 15 seconds grace period for network latency or clock differences during checkout
    if (!isNaN(pkgUpdated) && !isNaN(ticketPurchased) && ticketPurchased < (pkgUpdated - 15000)) {
      return false;
    }
  }

  // 4. If the ticket has a recorded booking_code, ensure it matches current package's booking code
  if (ticket.booking_code && pkg.booking_code) {
    const cleanTicketCode = ticket.booking_code.trim().toUpperCase();
    const cleanPkgCode = pkg.booking_code.trim().toUpperCase();
    if (cleanTicketCode && cleanPkgCode && cleanTicketCode !== cleanPkgCode) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if the user has an active, valid ticket for the given package.
 */
export function hasUserPurchasedPackage(userTickets: any[], pkg: any): boolean {
  if (!userTickets || !pkg) return false;
  return userTickets.some((ticket) => isTicketValidForPackage(ticket, pkg));
}
