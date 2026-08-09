# =========================================================
# CODEDEPLOY IAM ROLE
# =========================================================

data "aws_iam_policy_document" "codedeploy_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type = "Service"

      identifiers = [
        "codedeploy.amazonaws.com"
      ]
    }

    actions = [
      "sts:AssumeRole"
    ]
  }
}

resource "aws_iam_role" "codedeploy" {
  name = "${local.name_prefix}-codedeploy-role"

  assume_role_policy = data.aws_iam_policy_document.codedeploy_assume_role.json

  tags = {
    Name = "${local.name_prefix}-codedeploy-role"
  }
}

# =========================================================
# CODEDEPLOY IAM POLICY
# =========================================================

resource "aws_iam_role_policy_attachment" "codedeploy" {
  role = aws_iam_role.codedeploy.name

  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}