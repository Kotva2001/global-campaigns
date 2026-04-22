export type Platform = "YouTube" | "Instagram" | "YB Shorts" | "TikTok" | "Other";
export type CurrencyCode = "CZK" | "EUR" | "HUF" | "RON";

export interface CampaignEntry {
  id: string;
  influencerId: string | null;
  country: string;
  influencer: string;
  campaignName: string;
  platform: Platform;
  publishDate: string;
  publishDateIso: string | null;
  videoLink: string;
  collaborationType: string;
  currency: CurrencyCode;
  campaignCost: number | null;
  utmLink: string;
  managedBy: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  sessions: number | null;
  engagementRate: number | null;
  purchaseRevenue: number | null;
  conversionRate: number | null;
}

export interface InfluencerRecord {
  id: string;
  name: string;
  country: string;
  platforms: string[] | null;
  youtube_channel_id: string | null;
  youtube_channel_url: string | null;
  instagram_handle: string | null;
  contact_email: string | null;
  contact_person: string | null;
  notes: string | null;
  status: "active" | "paused" | "ended";
}
