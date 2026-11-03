import {
  buildDeclarationPdf,
  declarationPdfFilename,
  type DeclarationPdfDeclaration,
} from "@/lib/declarationPdf";

type GymRulesDeclaration = DeclarationPdfDeclaration;

function gymRulesInput(declaration: GymRulesDeclaration) {
  return {
    title: "Gym Rules",
    filenameLabel: "Gym-Rules",
    sourceKey: "Gym-Rules",
    declaration,
  };
}

export function gymRulesPdfFilename(declaration: GymRulesDeclaration) {
  return declarationPdfFilename(gymRulesInput(declaration));
}

export function buildGymRulesPdf(declaration: GymRulesDeclaration) {
  return buildDeclarationPdf(gymRulesInput(declaration));
}
