export type Platform = "YouTube" | "Instagram" | "YB Shorts";

export interface CampaignEntry {
  id: string;
  country: string;
  influencer: string;
  campaignName: string;
  platform: Platform;
  publishDate: string;
  videoLink: string;
  collaborationType: string;
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
