import { LLMS_TXT } from '@/lib/seo/llms-content';
import { renderLlms } from '@/lib/seo/llms-render';

export const revalidate = 86400;

export function GET() {
  return renderLlms(LLMS_TXT);
}
