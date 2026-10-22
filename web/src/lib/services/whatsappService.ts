/**
 * WhatsApp Business API Service (Gupshup / Twilio / Interakt)
 * Used for automated Notice of Assignment (NOA) dispatch and 1-click OTP confirmation for SME Buyers.
 */

export interface WhatsAppTemplatePayload {
  toMobile: string;
  recipientName: string;
  sellerName: string;
  invoiceNumber: string;
  invoiceAmount: number;
  verificationUrl: string;
}

export class WhatsAppService {
  private static provider = process.env.WHATSAPP_PROVIDER || "GUPSHUP"; // GUPSHUP | TWILIO | INTERAKT
  private static apiKey = process.env.WHATSAPP_API_KEY || "test_sandbox_api_key";
  private static senderNumber = process.env.WHATSAPP_SENDER || "+919876500000";

  /**
   * Dispatches automated HSM (Highly Structured Message) template for Invoice Notice of Assignment
   */
  static async sendInvoiceNOATemplate(payload: WhatsAppTemplatePayload): Promise<{
    success: boolean;
    messageId?: string;
    deliveryStatus: string;
  }> {
    const cleanMobile = payload.toMobile.replace(/\D/g, "");

    // In production, invoke Gupshup / Twilio / Interakt REST API
    // Template: "invoice_noa_verification_v1"
    const templateData = {
      template: "invoice_noa_verification_v1",
      params: [
        payload.recipientName,
        payload.sellerName,
        payload.invoiceNumber,
        `₹${payload.invoiceAmount.toLocaleString("en-IN")}`,
        payload.verificationUrl,
      ],
    };

    console.log(`[WhatsAppService] Dispatched HSM NOA to +91${cleanMobile}:`, templateData);

    return {
      success: true,
      messageId: `wamid_simulated_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      deliveryStatus: "DELIVERED",
    };
  }

  /**
   * Dispatches 6-digit WhatsApp OTP for 30-second SME Buyer Confirmation
   */
  static async sendBuyerConfirmationOtp(mobile: string, otp: string, invoiceNumber: string): Promise<boolean> {
    const cleanMobile = mobile.replace(/\D/g, "");
    console.log(`[WhatsAppService] Sent WhatsApp OTP [${otp}] to +91${cleanMobile} for Invoice #${invoiceNumber}`);
    return true;
  }
}
